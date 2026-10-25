from __future__ import annotations
import os
import glob
import time
import json
import math
import hashlib
import pickle
import traceback
from typing import Dict, Any, Optional, List, Tuple

try:
	from backend.config import PROMPT_CACHE_DIR, MAX_PROMPT_CACHES, PROMPT_CACHE_TTL, PROMPT_CACHE_HALF_LIFE
except ImportError:
	PROMPT_CACHE_DIR = os.getenv("PROMPT_CACHE_DIR", "./cache/prompt_states")
	MAX_PROMPT_CACHES = int(os.getenv("MAX_PROMPT_CACHES", "10"))
	PROMPT_CACHE_TTL = int(os.getenv("PROMPT_CACHE_TTL", "0"))
	PROMPT_CACHE_HALF_LIFE = int(os.getenv("PROMPT_CACHE_HALF_LIFE", "1800"))

try:
	import llama_cpp
except ImportError:
	llama_cpp = None


def truncate_llm_state(llm: Any, target_tokens: int) -> bool:
	"""
	Desplaza el cursor del KV cache hacia atras hasta `target_tokens`.
	Elimina todas las posiciones >= target_tokens en la memoria C++ del modelo
	y ajusta el estado interno de Llama para continuar evaluando desde alli.
	"""
	if not llm or not hasattr(llm, "n_tokens"):
		return False
	current_tokens = llm.n_tokens
	if target_tokens >= current_tokens:
		return True
	if target_tokens < 0:
		return False

	try:
		if hasattr(llm, "_ctx") and hasattr(llm._ctx, "kv_cache_seq_rm"):
			llm._ctx.kv_cache_seq_rm(-1, target_tokens, -1)
		elif llama_cpp and hasattr(llama_cpp, "llama_memory_seq_rm") and hasattr(llm, "_ctx"):
			llama_cpp.llama_memory_seq_rm(llm._ctx.ctx, -1, target_tokens, -1)
	except Exception as e:
		print(f"[PromptCache] Error in truncate_llm_state: {e}")
		return False

	llm.n_tokens = target_tokens
	if hasattr(llm, "input_ids"):
		llm.input_ids[target_tokens:] = 0
	llm._requires_eval = True
	return True


def _parse_yaml_fallback(yaml_text: str) -> dict:
	metadata: Dict[str, Any] = {}
	current_section = None
	current_tool = None
	current_key = None

	for raw_line in yaml_text.splitlines():
		line = raw_line.rstrip()
		if not line or line.startswith("#"):
			continue
		indent = len(raw_line) - len(raw_line.lstrip(" "))
		stripped = line.strip()

		if indent == 0 and ":" in stripped:
			k, v = stripped.split(":", 1)
			k, v = k.strip(), v.strip().strip('"\'')
			current_section = k
			current_tool = None
			current_key = None
			if k == "tools":
				metadata["tools"] = {}
			else:
				metadata[k] = float(v) if v.replace(".", "", 1).isdigit() else v
		elif indent == 2 and current_section == "tools" and ":" in stripped:
			tool_name = stripped.split(":", 1)[0].strip()
			current_tool = tool_name
			current_key = None
			metadata.setdefault("tools", {})[tool_name] = {}
		elif indent == 4 and current_tool and ":" in stripped:
			k, v = stripped.split(":", 1)
			k, v = k.strip(), v.strip().strip('"\'')
			current_key = k
			if k == "rules":
				metadata.setdefault("tools", {}).setdefault(current_tool, {})["rules"] = []
			elif k == "max_calls":
				metadata.setdefault("tools", {}).setdefault(current_tool, {})["max_calls"] = int(v) if v.isdigit() else v
			elif k == "purpose":
				metadata.setdefault("tools", {}).setdefault(current_tool, {})["purpose"] = v
			else:
				metadata.setdefault("tools", {}).setdefault(current_tool, {})[k] = v
		elif indent >= 6 and current_tool and current_key == "rules" and stripped.startswith("-"):
			rule_text = stripped[1:].strip().strip('"\'')
			metadata.setdefault("tools", {}).setdefault(current_tool, {}).setdefault("rules", []).append(rule_text)

	return metadata

def _parse_and_get_effective_prompt(content: str) -> Tuple[str, dict]:
	trimmed = content.strip()
	if not trimmed.startswith("---"):
		return content, {}

	parts = trimmed.split("---", 2)
	if len(parts) < 3:
		return content, {}

	yaml_text = parts[1]
	body_text = parts[2].strip()

	metadata: Dict[str, Any] = {}
	try:
		import yaml
		metadata = yaml.safe_load(yaml_text) or {}
	except Exception:
		pass
	if not metadata:
		metadata = _parse_yaml_fallback(yaml_text)

	tools_config = metadata.get("tools") or {}
	if not tools_config:
		return body_text, metadata

	guidelines = ["\n\n## Herramientas Asignadas y Directrices de Uso"]
	guidelines.append("Dispones ÚNICAMENTE de las siguientes herramientas autorizadas para tu rol:")

	for tool_name, cfg in tools_config.items():
		if not isinstance(cfg, dict):
			continue
		purpose = cfg.get("purpose", "")
		max_calls = cfg.get("max_calls")
		rules = cfg.get("rules", [])

		tool_block = [f"- `{tool_name}`:"]
		if purpose:
			tool_block.append(f"  - **Propósito**: {purpose}")
		if rules:
			tool_block.append("  - **Reglas y Restricciones**:")
			for r in rules:
				tool_block.append(f"    * {r}")
		if max_calls is not None:
			tool_block.append(f"  - **Límite por turno**: Máximo {max_calls} llamada(s). Prohibido exceder este límite.")

		guidelines.append("\n".join(tool_block))

	guidelines.append("\n**IMPORTANTE**: No intentes invocar ninguna herramienta ajena a esta lista ni superar los límites fijados.")
	return body_text + "\n" + "\n".join(guidelines), metadata

def load_master_tools_registry() -> Dict[str, dict]:
	search_dirs = [
		os.getenv("PROMPTS_DIR", ""),
		"/app/prompts",
		"./prompts",
		"../prompts",
		os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))
	]
	for d in search_dirs:
		if d and os.path.isdir(d):
			candidate = os.path.join(d, "tools_registry.json")
			if os.path.exists(candidate):
				try:
					with open(candidate, "r", encoding="utf-8") as f:
						return json.load(f)
				except Exception:
					pass
	return {}

MASTER_TOOLS_REGISTRY: Dict[str, dict] = load_master_tools_registry()

def load_all_agent_prompts_and_metadata() -> Tuple[Dict[str, str], Dict[str, dict]]:
	prompts: Dict[str, str] = {
		"main_agent": "Eres un asistente conversacional inteligente, conciso y directo en español.",
		"researcher": "Eres un sub-agente especialista en investigación y análisis factual riguroso.",
		"coder": "Eres un sub-agente ingeniero de software senior.",
		"writer": "Eres un sub-agente especialista en redacción ejecutiva y comunicación clara."
	}
	agent_meta: Dict[str, dict] = {}

	search_dirs = [
		os.getenv("PROMPTS_DIR", ""),
		"/app/prompts",
		"./prompts",
		"../prompts",
		os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prompts"))
	]
	prompts_dir = None
	for d in search_dirs:
		if d and os.path.isdir(d):
			prompts_dir = d
			break

	if prompts_dir:
		for filename in os.listdir(prompts_dir):
			if filename.endswith(".md") or filename.endswith(".txt"):
				stem = os.path.splitext(filename)[0]
				filepath = os.path.join(prompts_dir, filename)
				try:
					with open(filepath, "r", encoding="utf-8") as f:
						raw_content = f.read().strip()
						if raw_content:
							effective_content, meta = _parse_and_get_effective_prompt(raw_content)
							key = "main_agent" if stem in ("system_prompt", "main", "main_agent") else stem
							prompts[key] = effective_content
							agent_meta[key] = meta
				except Exception:
					pass
	return prompts, agent_meta

DEFAULT_AGENT_PROMPTS, DEFAULT_AGENT_METADATA = load_all_agent_prompts_and_metadata()

def build_tools_for_agent_metadata(metadata: dict) -> List[dict]:
	tools_cfg = metadata.get("tools") or {}
	if not tools_cfg:
		return []

	built_tools = []
	for tool_name, cfg in tools_cfg.items():
		registry_entry = MASTER_TOOLS_REGISTRY.get(tool_name)
		if registry_entry:
			schema_copy = json.loads(json.dumps(registry_entry))
			if isinstance(cfg, dict) and cfg.get("purpose"):
				schema_copy["function"]["description"] = cfg["purpose"]
			built_tools.append(schema_copy)
		else:
			purpose = cfg.get("purpose", "") if isinstance(cfg, dict) else ""
			built_tools.append({
				"type": "function",
				"function": {
					"name": tool_name,
					"description": purpose or f"Herramienta {tool_name}",
					"parameters": {
						"type": "object",
						"properties": {
							"task": {"type": "string", "description": "Tarea a procesar"}
						},
						"required": ["task"]
					}
				}
			})
	return built_tools


CACHE_FORMAT_VERSION = 3

class PromptCacheManager:
	def __init__(
		self,
		cache_dir: str | None = None,
		configured_prompts: Dict[str, str] | None = None,
		max_caches: int | None = None,
		ttl_seconds: int | None = None,
		half_life_seconds: int | None = None
	):
		self.cache_dir = cache_dir or PROMPT_CACHE_DIR
		os.makedirs(self.cache_dir, exist_ok=True)
		self.configured_prompts: Dict[str, str] = configured_prompts if configured_prompts is not None else DEFAULT_AGENT_PROMPTS
		self.agent_metadata: Dict[str, dict] = DEFAULT_AGENT_METADATA
		self.max_caches: int = max_caches or MAX_PROMPT_CACHES
		self.ttl_seconds: int = ttl_seconds if ttl_seconds is not None else PROMPT_CACHE_TTL
		self.half_life_seconds: float = float(half_life_seconds or PROMPT_CACHE_HALF_LIFE)

		# System prompts RAM cache: hash -> cache payload dict
		self.ram_cache: Dict[str, Dict[str, Any]] = {}
		self.agent_hash_map: Dict[str, str] = {}

		# Dynamic temporal caches: list of {cache_id, tokens, token_count, state, last_used, ema_score, hit_count, is_system}
		self.temporal_caches: List[Dict[str, Any]] = []

		# In-memory caller context snapshots for delegation
		self.ram_snapshots: Dict[str, Any] = {}
		self.load_configured_to_ram()

	def calculate_current_ema(self, entry: Dict[str, Any], now: float) -> float:
		"""Calcula el score EMA actual aplicando decaimiento exponencial continuo."""
		last_used = entry.get("last_used", now)
		base_score = entry.get("ema_score", 1.0)
		dt = max(0.0, now - last_used)
		# Constante de desintegracion (lambda) derivada del periodo de vida media
		decay = math.exp(- (0.69314718056 / max(1.0, self.half_life_seconds)) * dt)
		return base_score * decay

	def record_cache_hit(self, entry: Dict[str, Any], now: float):
		"""Incrementa el valor EMA del cache al ser reutilizado activamente."""
		current_score = self.calculate_current_ema(entry, now)
		entry["ema_score"] = current_score + 1.0
		entry["last_used"] = now
		entry["hit_count"] = entry.get("hit_count", 0) + 1

	def save_snapshot(self, snapshot_id: str, state: Any):
		self.ram_snapshots[snapshot_id] = state
		print(f"[PromptCache] Context snapshot '{snapshot_id}' preserved in RAM.")

	def get_snapshot(self, snapshot_id: str) -> Optional[Any]:
		return self.ram_snapshots.get(snapshot_id)

	def pop_snapshot(self, snapshot_id: str) -> Optional[Any]:
		state = self.ram_snapshots.pop(snapshot_id, None)
		if state:
			print(f"[PromptCache] Context snapshot '{snapshot_id}' retrieved and popped from RAM.")
		return state

	@staticmethod
	def compute_hash(prompt_text: str, tools: list | None = None) -> str:
		clean_text = prompt_text.strip()
		if tools:
			try:
				tools_str = json.dumps(tools, sort_keys=True)
				clean_text += "##TOOLS##" + tools_str
			except Exception:
				pass
		return hashlib.sha256(clean_text.encode("utf-8")).hexdigest()[:16]

	def get_cache_filepath(self, agent_name: str, prompt_hash: str) -> str:
		return os.path.join(self.cache_dir, f"{agent_name}_{prompt_hash}.bin")

	def load_configured_to_ram(self):
		loaded_count = 0
		prompts_to_load = self.configured_prompts or DEFAULT_AGENT_PROMPTS

		for agent_name, prompt_text in prompts_to_load.items():
			meta = self.agent_metadata.get(agent_name, {})
			agent_tools = build_tools_for_agent_metadata(meta)
			expected_hash = self.compute_hash(prompt_text, tools=agent_tools if agent_tools else None)
			self.remove_stale_agent_cache(agent_name, expected_hash)
			filepath = self.get_cache_filepath(agent_name, expected_hash)

			if os.path.exists(filepath):
				try:
					with open(filepath, "rb") as f:
						data = pickle.load(f)
					prompt_hash = data.get("hash")
					tokens = data.get("tokens", [])
					# Invalidate caches from older versions without clean prefix token slicing
					if data.get("cache_format_version") != CACHE_FORMAT_VERSION:
						print(f"[PromptCache] Outdated cache version in '{filepath}' (requires v{CACHE_FORMAT_VERSION}). Removing to regenerate.")
						try:
							os.remove(filepath)
						except Exception:
							pass
						continue

					if prompt_hash == expected_hash and "state" in data:
						data["is_system"] = True
						data["last_used"] = time.time()
						data["token_count"] = len(tokens)
						self.ram_cache[prompt_hash] = data
						self.agent_hash_map[agent_name] = prompt_hash
						loaded_count += 1
				except Exception as e:
					print(f"[PromptCache] Failed to load binary cache '{filepath}': {e}")

		print(f"[PromptCache] Pre-loaded {loaded_count} configured binary prompt caches into RAM.")

	def remove_stale_agent_cache(self, agent_name: str, new_hash: str):
		pattern = os.path.join(self.cache_dir, f"{agent_name}_*.bin")
		for filepath in glob.glob(pattern):
			filename = os.path.basename(filepath)
			if f"{agent_name}_{new_hash}.bin" != filename:
				try:
					os.remove(filepath)
					print(f"[PromptCache] Removed stale cache: {filepath}")
				except Exception as e:
					print(f"[PromptCache] Failed removing stale cache '{filepath}': {e}")

	def get_chat_formatter(self, llm: Any) -> Any:
		handler = getattr(llm, "chat_handler", None)
		if not handler and hasattr(llm, "_chat_handlers"):
			chat_fmt = getattr(llm, "chat_format", "chat_template.default")
			handler = llm._chat_handlers.get(chat_fmt) or llm._chat_handlers.get("chat_template.default")

		if handler and hasattr(handler, "__closure__") and handler.__closure__:
			for cell in handler.__closure__:
				if callable(cell.cell_contents):
					return cell.cell_contents
		return None

	def tokenize_messages(self, llm: Any, messages: list, tools: list | None = None) -> List[int]:
		if not llm or not hasattr(llm, "tokenize"):
			return []

		formatter = self.get_chat_formatter(llm)
		if formatter:
			kwargs: Dict[str, Any] = {}
			if tools:
				kwargs["tools"] = tools
			try:
				res = formatter(messages=messages, **kwargs)
				prompt_text = getattr(res, "prompt", str(res))
				added_special = getattr(res, "added_special", False)
				return list(llm.tokenize(prompt_text.encode("utf-8"), add_bos=not added_special, special=True))
			except Exception as e:
				print(f"[PromptCache] Warning: Chat formatter tokenize failed: {e}")

		# Fallback tokenization
		sys_msg = next((m.get("content", "") for m in messages if m.get("role") == "system"), "")
		if sys_msg:
			return list(llm.tokenize(sys_msg.encode("utf-8")))
		return []

	def tokenize_system_prompt_prefix(self, llm: Any, prompt_text: str, tools: list | None = None) -> List[int]:
		if not llm or not hasattr(llm, "tokenize"):
			return []

		formatter = self.get_chat_formatter(llm)
		if formatter:
			kwargs: Dict[str, Any] = {}
			if tools:
				kwargs["tools"] = tools
			try:
				sentinel = "__USER_PROMPT_SENTINEL__"
				res = formatter(
					messages=[
						{"role": "system", "content": prompt_text},
						{"role": "user", "content": sentinel}
					],
					**kwargs
				)
				raw = getattr(res, "prompt", str(res))
				if sentinel in raw:
					prefix_raw = raw.split(sentinel)[0]
					for tag in ["<start_of_turn>", "<|im_start|>", "<|start_header_id|>", "[INST]"]:
						last_idx = prefix_raw.rfind(tag)
						if last_idx != -1:
							prefix_raw = prefix_raw[:last_idx]
							break
					raw = prefix_raw
				added_special = getattr(res, "added_special", False)
				tokens = list(llm.tokenize(raw.encode("utf-8"), add_bos=not added_special, special=True))
				# Strip any trailing generation/assistant prompt tokens (e.g. <start_of_turn>model\n)
				if len(tokens) >= 3 and tokens[-3:] == [105, 4368, 107]:
					tokens = tokens[:-3]
				return tokens
			except Exception as e:
				print(f"[PromptCache] Notice in tokenize_system_prompt_prefix: {e}")

		return list(llm.tokenize(prompt_text.encode("utf-8")))

	def clean_expired_temporals(self):
		if self.ttl_seconds <= 0:
			# TTL <= 0 significa tiempo infinito, la sustitucion se gestiona puramente por scoring EMA
			return

		now = time.time()
		valid_temporals = []
		for entry in self.temporal_caches:
			if (now - entry.get("last_used", now)) <= self.ttl_seconds:
				valid_temporals.append(entry)
			else:
				print(f"[PromptCache] Expired temporal cache '{entry.get('cache_id')}' (TTL {self.ttl_seconds}s reached).")
		self.temporal_caches = valid_temporals

	def enforce_max_caches(self):
		if len(self.temporal_caches) > self.max_caches:
			now = time.time()
			# Ordenar por EMA score ascendente: el cache con menor valor ponderado se desaloja primero
			self.temporal_caches.sort(key=lambda c: self.calculate_current_ema(c, now))
			excess = len(self.temporal_caches) - self.max_caches
			removed = self.temporal_caches[:excess]
			self.temporal_caches = self.temporal_caches[excess:]
			for r in removed:
				score = self.calculate_current_ema(r, now)
				print(f"[PromptCache] Evicted low-EMA temporal cache '{r.get('cache_id')}' (score={score:.4f}, hits={r.get('hit_count', 1)}, limit {self.max_caches}).")

	def find_best_matching_cache(self, request_tokens: List[int]) -> Tuple[Optional[Dict[str, Any]], int]:
		if not request_tokens:
			return None, 0

		self.clean_expired_temporals()

		best_cache: Optional[Dict[str, Any]] = None
		max_matched_len = 0

		# 1. System prompt caches (permanentes, intocables)
		system_entries = list(self.ram_cache.values())
		# 2. Dynamic temporal caches (compiten por EMA score)
		candidates = system_entries + self.temporal_caches

		for entry in candidates:
			cached_tokens = entry.get("tokens") or []
			c_len = len(cached_tokens)
			if c_len == 0:
				continue

			prefix_match = 0
			while prefix_match < min(c_len, len(request_tokens)) and cached_tokens[prefix_match] == request_tokens[prefix_match]:
				prefix_match += 1

			name = entry.get("agent_name") or entry.get("cache_id")
			print(f"[Prefix Debug] Candidate '{name}': cached_len={c_len}, req_len={len(request_tokens)}, matched={prefix_match}/{c_len}", flush=True)

			# Selecciona el candidato con el prefijo comun mas largo
			if prefix_match > max_matched_len:
				max_matched_len = prefix_match
				best_cache = entry

		return best_cache, max_matched_len

	def apply_best_cache(self, llm: Any, request_tokens: List[int], min_match: int = 16) -> Tuple[bool, Optional[Dict[str, Any]], int]:
		best_cache, matched_count = self.find_best_matching_cache(request_tokens)
		if best_cache and matched_count >= min_match and hasattr(llm, "load_state"):
			try:
				now = time.time()
				llm.load_state(best_cache["state"])
				cached_len = len(best_cache.get("tokens", []))
				name = best_cache.get("agent_name") or best_cache.get("cache_id")

				# Actualizar score EMA solo si es un cache temporal de dialogo
				if not best_cache.get("is_system", False):
					self.record_cache_hit(best_cache, now)
					print(f"[PromptCache] Temporal cache '{name}' hit recorded (new EMA score: {best_cache.get('ema_score', 0):.2f}).", flush=True)
				else:
					best_cache["last_used"] = now

				# Si el prefijo comun es menor que la longitud del cache, desplazamos el cursor y podar KV cache
				if matched_count < cached_len:
					truncate_llm_state(llm, matched_count)
					print(f"[PromptCache] Loaded cache '{name}' and trimmed cursor from {cached_len} to {matched_count} tokens.", flush=True)
				else:
					print(f"[PromptCache] Loaded exact 100% cache '{name}' ({matched_count} tokens).", flush=True)

				return True, best_cache, matched_count
			except Exception as e:
				print(f"[PromptCache] Error loading state from best cache: {e}")
		return False, None, 0

	def save_or_replace_temporal_cache(
		self,
		used_cache: Optional[Dict[str, Any]],
		request_tokens: List[int],
		new_state: Any
	):
		now = time.time()
		# Si se utilizo un cache temporal (no-system) y todos sus tokens estan contenidos en el prompt:
		if used_cache and not used_cache.get("is_system", False):
			cached_tokens = used_cache.get("tokens", [])
			if cached_tokens and request_tokens[:len(cached_tokens)] == cached_tokens:
				used_cache["tokens"] = list(request_tokens)
				used_cache["token_count"] = len(request_tokens)
				used_cache["state"] = new_state
				self.record_cache_hit(used_cache, now)
				print(f"[PromptCache] Extended temporal cache '{used_cache.get('cache_id')}' in-place to {len(request_tokens)} tokens (EMA: {used_cache.get('ema_score', 0):.2f}).")
				return

		# Si vino de un system prompt o un nuevo flujo, compite en la lista de temporales
		cache_id = f"temporal_{int(now * 1000)}_{len(request_tokens)}"
		entry = {
			"cache_id": cache_id,
			"tokens": list(request_tokens),
			"token_count": len(request_tokens),
			"state": new_state,
			"last_used": now,
			"ema_score": 1.0,
			"hit_count": 1,
			"is_system": False
		}
		self.temporal_caches.append(entry)
		self.enforce_max_caches()
		print(f"[PromptCache] Saved new temporal cache '{cache_id}' ({len(request_tokens)} tokens, EMA=1.0). Active temporals: {len(self.temporal_caches)}.")

	def save_cache(self, agent_name: str, prompt_text: str, state: Any, tokens: list, tools: list | None = None) -> str:
		prompt_hash = self.compute_hash(prompt_text, tools=tools)
		self.remove_stale_agent_cache(agent_name, prompt_hash)

		filepath = self.get_cache_filepath(agent_name, prompt_hash)
		payload = {
			"agent_name": agent_name,
			"hash": prompt_hash,
			"tokens": list(tokens),
			"token_count": len(tokens),
			"state": state,
			"is_system": True,
			"last_used": time.time(),
			"cache_format_version": CACHE_FORMAT_VERSION
		}

		try:
			with open(filepath, "wb") as f:
				pickle.dump(payload, f)
			self.ram_cache[prompt_hash] = payload
			self.agent_hash_map[agent_name] = prompt_hash
			print(f"[PromptCache] Saved binary cache for '{agent_name}' ({prompt_hash}) to disk and RAM.")
		except Exception as e:
			print(f"[PromptCache] Failed to save binary cache '{filepath}': {e}")

		return prompt_hash

	def warmup_defaults(self, llm: Any):
		if not llm:
			return

		print("[PromptCache] Warming up default agent system prompt caches with tools...")
		prompts_to_warm = self.configured_prompts or DEFAULT_AGENT_PROMPTS
		for agent_name, prompt_text in prompts_to_warm.items():
			meta = self.agent_metadata.get(agent_name, {})
			agent_tools = build_tools_for_agent_metadata(meta)
			prompt_hash = self.compute_hash(prompt_text, tools=agent_tools if agent_tools else None)

			if prompt_hash in self.ram_cache:
				continue

			try:
				if hasattr(llm, "reset"):
					llm.reset()

				tokens = self.tokenize_system_prompt_prefix(llm, prompt_text, tools=agent_tools if agent_tools else None)

				if tokens and hasattr(llm, "eval"):
					llm.eval(tokens)
				if hasattr(llm, "save_state"):
					state = llm.save_state()
					self.save_cache(agent_name, prompt_text, state, tokens, tools=agent_tools if agent_tools else None)
			except Exception as e:
				print(f"[PromptCache] Warning: Could not pre-evaluate '{agent_name}': {e}")

	def get_memory_breakdown(self) -> dict:
		prompt_caches = []
		total_prompt_cache_ram_mb = 0.0

		for h, data in self.ram_cache.items():
			token_count = len(data.get("tokens", []))
			kv_mb = round(token_count * 0.125, 2)
			total_prompt_cache_ram_mb += kv_mb
			prompt_caches.append({
				"agent_name": data.get("agent_name", "custom"),
				"hash": h,
				"tokens": token_count,
				"kv_ram_mb": kv_mb,
				"total_mb": kv_mb
			})

		temporal_snapshots = []
		total_temporal_ram_mb = 0.0
		self.clean_expired_temporals()

		for entry in self.temporal_caches:
			t_count = len(entry.get("tokens", []))
			kv_mb = round(t_count * 0.125, 2)
			total_temporal_ram_mb += kv_mb
			temporal_snapshots.append({
				"cache_id": entry.get("cache_id"),
				"tokens": t_count,
				"total_mb": kv_mb,
				"last_used": entry.get("last_used")
			})

		return {
			"prompt_caches": prompt_caches,
			"prompt_caches_total_mb": round(total_prompt_cache_ram_mb, 2),
			"prompt_caches_count": len(prompt_caches),
			"temporal_caches": temporal_snapshots,
			"temporal_caches_total_mb": round(total_temporal_ram_mb, 2),
			"temporal_caches_count": len(temporal_snapshots),
			"max_caches": self.max_caches,
			"ttl_seconds": self.ttl_seconds
		}
