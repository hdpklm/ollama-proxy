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
	from backend.config import PROMPT_CACHE_DIR, MAX_PROMPT_CACHES, PROMPT_CACHE_TTL, PROMPT_CACHE_HALF_LIFE, PROMPT_CACHE_TOLERANCE
except ImportError:
	PROMPT_CACHE_DIR = os.getenv("PROMPT_CACHE_DIR", "./cache/prompt_states")
	MAX_PROMPT_CACHES = int(os.getenv("MAX_PROMPT_CACHES", "10"))
	PROMPT_CACHE_TTL = int(os.getenv("PROMPT_CACHE_TTL", "0"))
	PROMPT_CACHE_HALF_LIFE = int(os.getenv("PROMPT_CACHE_HALF_LIFE", "1800"))
	PROMPT_CACHE_TOLERANCE = int(os.getenv("PROMPT_CACHE_TOLERANCE", "15"))

try:
	import llama_cpp
except ImportError:
	llama_cpp = None

from backend.adapters import get_adapter, BaseModelAdapter


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

class CacheTreeNode:
	def __init__(
		self,
		tokens: List[int],
		state: Any = None,
		is_system: bool = False,
		parent: Optional[CacheTreeNode] = None,
		cache_id: Optional[str] = None,
		agent_name: Optional[str] = None,
		prompt_hash: Optional[str] = None
	):
		self.tokens: List[int] = list(tokens)
		self.state: Any = state
		self.is_system: bool = is_system
		self.parent: Optional[CacheTreeNode] = parent
		self.children: List[CacheTreeNode] = []
		self.cache_id: str = cache_id or f"node_{int(time.time() * 1000)}_{len(tokens)}"
		self.agent_name: Optional[str] = agent_name
		self.prompt_hash: Optional[str] = prompt_hash
		self.last_used: float = time.time()
		self.hit_count: int = 1
		self.ema_score: float = 1.0

	def get_path_tokens(self) -> List[int]:
		"""Returns all tokens accumulated from root down to this node."""
		path = []
		curr: Optional[CacheTreeNode] = self
		while curr is not None and curr.tokens:
			path.append(curr.tokens)
			curr = curr.parent
		res = []
		for seg in reversed(path):
			res.extend(seg)
		return res

	# Dict-like compatibility interface
	def get(self, key: str, default: Any = None) -> Any:
		if key == "cache_id":
			return self.cache_id
		if key == "tokens":
			return self.tokens
		if key == "state":
			return self.state
		if key == "is_system":
			return self.is_system
		if key == "last_used":
			return self.last_used
		if key == "ema_score":
			return self.ema_score
		if key == "hit_count":
			return self.hit_count
		if key == "agent_name":
			return self.agent_name
		if key == "token_count":
			return len(self.tokens)
		if key in ("prompt_hash", "hash"):
			return self.prompt_hash
		return default

	def __getitem__(self, key: str) -> Any:
		val = self.get(key)
		if val is None and key not in ("parent", "agent_name", "prompt_hash", "hash", "state"):
			raise KeyError(key)
		return val

	def __setitem__(self, key: str, value: Any):
		if key == "tokens":
			self.tokens = list(value)
		elif key == "state":
			self.state = value
		elif key == "last_used":
			self.last_used = value
		elif key == "ema_score":
			self.ema_score = value
		elif key == "hit_count":
			self.hit_count = value
		elif key == "is_system":
			self.is_system = value
		elif key == "cache_id":
			self.cache_id = value
		elif key == "agent_name":
			self.agent_name = value
		elif key in ("prompt_hash", "hash"):
			self.prompt_hash = value

	def __contains__(self, key: str) -> bool:
		return self.get(key) is not None

	def to_dict(self) -> dict:
		data_summary = f"tokens: {len(self.tokens)}, ema: {self.ema_score:.2f}, hits: {self.hit_count}, is_sys: {self.is_system}"
		if self.agent_name:
			data_summary += f", agent: {self.agent_name}"
		return {
			"name": self.agent_name or self.cache_id,
			"cache_id": self.cache_id,
			"agent_name": self.agent_name,
			"is_system": self.is_system,
			"token_count": len(self.tokens),
			"tokens_sample": self.tokens[:15] if len(self.tokens) > 15 else self.tokens,
			"data": data_summary,
			"hit_count": self.hit_count,
			"ema_score": round(self.ema_score, 4),
			"last_used": self.last_used,
			"updated_at": self.last_used,
			"children": {
				(child.agent_name or child.cache_id): child.to_dict()
				for child in self.children
			}
		}


class PromptCacheManager:
	def __init__(
		self,
		cache_dir: str | None = None,
		configured_prompts: Dict[str, str] | None = None,
		max_caches: int | None = None,
		ttl_seconds: int | None = None,
		half_life_seconds: int | None = None,
		replace_tolerance: int | None = None,
		adapter: BaseModelAdapter | None = None
	):
		self.cache_dir = cache_dir or PROMPT_CACHE_DIR
		os.makedirs(self.cache_dir, exist_ok=True)
		self.configured_prompts: Dict[str, str] = configured_prompts if configured_prompts is not None else DEFAULT_AGENT_PROMPTS
		self.agent_metadata: Dict[str, dict] = DEFAULT_AGENT_METADATA
		self.max_caches: int = max_caches or MAX_PROMPT_CACHES
		self.ttl_seconds: int = ttl_seconds if ttl_seconds is not None else PROMPT_CACHE_TTL
		self.half_life_seconds: float = float(half_life_seconds or PROMPT_CACHE_HALF_LIFE)
		self.replace_tolerance: int = int(replace_tolerance if replace_tolerance is not None else PROMPT_CACHE_TOLERANCE)
		self.adapter: BaseModelAdapter = adapter or get_adapter()

		# Virtual root of hierarchical Radix Tree
		self.root: CacheTreeNode = CacheTreeNode(tokens=[], state=None, is_system=True, cache_id="root")

		# System prompts RAM cache: hash -> CacheTreeNode (and dict interface compatibility)
		self.ram_cache: Dict[str, Any] = {}
		self.agent_hash_map: Dict[str, str] = {}

		# Dynamic EOS / EOT tokens learned from active LLM and adapter
		self.known_eos_token_ids: set[int] = set()

		# In-memory caller context snapshots for delegation
		self.ram_snapshots: Dict[str, Any] = {}
		self.load_configured_to_ram()

	def init_adapter_eos(self, llm: Any):
		"""Initializes model-specific EOS tokens from the active adapter."""
		if llm and self.adapter:
			self.known_eos_token_ids = self.adapter.get_eos_token_ids(llm)
			print(f"[PromptCache] Initialized EOS tokens for adapter '{self.adapter.name}': {self.known_eos_token_ids}", flush=True)

	def get_eos_token_ids(self, llm: Any = None) -> set[int]:
		if not self.known_eos_token_ids and llm and self.adapter:
			self.known_eos_token_ids = self.adapter.get_eos_token_ids(llm)
		return set(self.known_eos_token_ids)

	def strip_eos_tokens(self, llm: Any, tokens: List[int]) -> List[int]:
		"""
		Detects the first EOS / End-Of-Sequence / End-Of-Turn token in the sequence using the model's adapter.
		Strips that token and all subsequent tokens, returning only the prefix before EOS.
		"""
		if not tokens:
			return []

		eos_set = self.get_eos_token_ids(llm)
		for idx, tok in enumerate(tokens):
			if tok in eos_set:
				stripped_count = len(tokens) - idx
				print(f"[PromptCache] Adapter '{self.adapter.name}' stripped EOS token ({tok}) and {stripped_count - 1} trailing tokens beyond EOS from cache.", flush=True)
				return tokens[:idx]

		return list(tokens)

	def get_all_nodes(self, start_node: Optional[CacheTreeNode] = None) -> List[CacheTreeNode]:
		node = start_node or self.root
		res = []
		for child in node.children:
			res.append(child)
			res.extend(self.get_all_nodes(child))
		return res

	@property
	def temporal_caches(self) -> List[CacheTreeNode]:
		"""Returns all non-system temporal nodes in the Radix Tree."""
		return [n for n in self.get_all_nodes() if not n.is_system]

	def calculate_current_ema(self, entry: CacheTreeNode | Dict[str, Any], now: float) -> float:
		"""Calcula el score EMA actual aplicando decaimiento exponencial continuo."""
		last_used = entry.get("last_used", now)
		base_score = entry.get("ema_score", 1.0)
		dt = max(0.0, now - last_used)
		# Constante de desintegracion (lambda) derivada del periodo de vida media
		decay = math.exp(- (0.69314718056 / max(1.0, self.half_life_seconds)) * dt)
		return base_score * decay

	def record_cache_hit(self, entry: CacheTreeNode | Dict[str, Any], now: float):
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
						sys_node = CacheTreeNode(
							tokens=tokens,
							state=data["state"],
							is_system=True,
							parent=self.root,
							cache_id=f"sys_{agent_name}",
							agent_name=agent_name,
							prompt_hash=prompt_hash
						)
						sys_node.last_used = time.time()
						self.root.children.append(sys_node)
						self.ram_cache[prompt_hash] = sys_node
						self.agent_hash_map[agent_name] = prompt_hash
						loaded_count += 1
				except Exception as e:
					print(f"[PromptCache] Failed to load binary cache '{filepath}': {e}")

		print(f"[PromptCache] Pre-loaded {loaded_count} configured binary prompt caches into RAM Radix Tree.")

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

	def prune_expired_nodes(self, node: CacheTreeNode, now: float) -> bool:
		"""
		Post-order bottom-up pruning:
		Prunes expired leaf nodes only if they have NO children and are NOT system prompts.
		Returns True if this node was pruned.
		"""
		# 1. First prune children recursively
		active_children = []
		for child in node.children:
			is_pruned = self.prune_expired_nodes(child, now)
			if not is_pruned:
				active_children.append(child)
		node.children = active_children

		# 2. Never prune system prompt nodes or the virtual root
		if node.is_system or node is self.root:
			return False

		# 3. Never prune a branch that still has active children
		if len(node.children) > 0:
			return False

		# 4. Leaf node without children: verify TTL
		if self.ttl_seconds > 0 and (now - node.last_used) > self.ttl_seconds:
			print(f"[PromptCache] Pruned expired leaf node '{node.cache_id}' (TTL {self.ttl_seconds}s reached).")
			return True

		return False

	def clean_expired_temporals(self):
		if self.ttl_seconds <= 0:
			# TTL <= 0 significa tiempo infinito, la sustitucion se gestiona puramente por scoring EMA
			return
		now = time.time()
		self.prune_expired_nodes(self.root, now)

	def enforce_max_caches(self):
		temporals = self.temporal_caches
		if len(temporals) <= self.max_caches:
			return

		now = time.time()
		while len(self.temporal_caches) > self.max_caches:
			# Collect only non-system leaf nodes (nodes with 0 children)
			leaves = [n for n in self.temporal_caches if len(n.children) == 0 and not n.is_system]
			if not leaves:
				break
			# Sort by lowest EMA score: el nodo hoja con menor valor ponderado se desaloja primero
			leaves.sort(key=lambda leaf: self.calculate_current_ema(leaf, now))
			victim = leaves[0]
			if victim.parent and victim in victim.parent.children:
				victim.parent.children.remove(victim)
				score = self.calculate_current_ema(victim, now)
				print(f"[PromptCache] Evicted low-EMA leaf node '{victim.cache_id}' (score={score:.4f}, hits={victim.hit_count}, limit {self.max_caches}).")
			else:
				break

	def find_best_matching_node(
		self,
		llm: Any,
		request_tokens: List[int]
	) -> Tuple[Optional[CacheTreeNode], int]:
		if not request_tokens:
			return None, 0

		self.clean_expired_temporals()

		curr = self.root
		matched_total = 0

		while matched_total < len(request_tokens):
			remaining_tokens = request_tokens[matched_total:]
			next_token = remaining_tokens[0]

			# Find child branch starting with the same token
			matched_child: Optional[CacheTreeNode] = None
			for child in curr.children:
				if child.tokens and child.tokens[0] == next_token:
					matched_child = child
					break

			if not matched_child:
				break

			child_len = len(matched_child.tokens)
			rem_len = len(remaining_tokens)
			common = 0
			while common < min(child_len, rem_len) and matched_child.tokens[common] == remaining_tokens[common]:
				common += 1

			# Case A: Exact full match of child node segment
			if common == child_len:
				matched_total += common
				curr = matched_child
				continue

			# Case B: Partial match within child node -> Node Split
			if 0 < common < child_len:
				prefix_tokens = matched_child.tokens[:common]
				suffix_tokens = matched_child.tokens[common:]
				matched_total += common

				# Truncate and snapshot KV state for the split prefix if LLM supports it
				split_state = None
				if llm and hasattr(llm, "load_state") and hasattr(llm, "save_state"):
					try:
						llm.load_state(matched_child.state)
						truncate_llm_state(llm, matched_total)
						split_state = llm.save_state()
					except Exception as e:
						print(f"[PromptCache] Notice in node split state truncation: {e}")

				# Split node retains the common prefix
				split_node = CacheTreeNode(
					tokens=prefix_tokens,
					state=split_state or matched_child.state,
					is_system=matched_child.is_system,
					parent=curr,
					cache_id=f"{matched_child.cache_id}_split_{common}",
					agent_name=matched_child.agent_name,
					prompt_hash=matched_child.prompt_hash
				)
				split_node.last_used = matched_child.last_used
				split_node.ema_score = matched_child.ema_score
				split_node.hit_count = matched_child.hit_count

				# Daughter 1 keeps the remaining existing tokens and original children
				hija_1 = CacheTreeNode(
					tokens=suffix_tokens,
					state=matched_child.state,
					is_system=matched_child.is_system,
					parent=split_node,
					cache_id=f"{matched_child.cache_id}_rest",
					agent_name=matched_child.agent_name
				)
				hija_1.children = matched_child.children
				for c in hija_1.children:
					c.parent = hija_1
				hija_1.last_used = matched_child.last_used
				hija_1.ema_score = matched_child.ema_score

				split_node.children = [hija_1]

				# Replace child in curr.children with split_node
				idx = curr.children.index(matched_child)
				curr.children[idx] = split_node

				curr = split_node
				break

			# Case C: No match on first token
			break

		if curr is self.root:
			return None, 0

		return curr, matched_total

	def apply_best_cache(self, llm: Any, request_tokens: List[int], min_match: int = 16) -> Tuple[bool, Optional[CacheTreeNode], int]:
		best_node, matched_count = self.find_best_matching_node(llm, request_tokens)
		if best_node and matched_count >= min_match and hasattr(llm, "load_state"):
			try:
				now = time.time()
				llm.load_state(best_node.state)
				name = best_node.agent_name or best_node.cache_id

				# Truncate if loaded state has more tokens than the matched prefix
				truncate_llm_state(llm, matched_count)

				if not best_node.is_system:
					self.record_cache_hit(best_node, now)
					print(f"[PromptCache] Radix node '{name}' hit recorded (new EMA: {best_node.ema_score:.2f}, matched: {matched_count}).", flush=True)
				else:
					best_node.last_used = now
					print(f"[PromptCache] Loaded Layer 1 System Prompt Radix node '{name}' ({matched_count} tokens).", flush=True)

				return True, best_node, matched_count
			except Exception as e:
				print(f"[PromptCache] Error loading state from best Radix node: {e}")
		return False, None, 0

	def save_or_replace_temporal_cache(
		self,
		used_cache: Optional[CacheTreeNode | Dict[str, Any]],
		request_tokens: List[int],
		new_state: Any
	):
		now = time.time()
		request_tokens = self.strip_eos_tokens(None, request_tokens)
		req_len = len(request_tokens)
		if req_len == 0:
			return

		target_node: Optional[CacheTreeNode] = None
		if isinstance(used_cache, CacheTreeNode):
			target_node = used_cache
		elif isinstance(used_cache, dict) and "cache_id" in used_cache:
			for node in self.get_all_nodes():
				if node.cache_id == used_cache.get("cache_id"):
					target_node = node
					break

		if target_node:
			accumulated_tokens = target_node.get_path_tokens()
			acc_len = len(accumulated_tokens)

			# If target_node is a leaf, not system prompt, and request_tokens is a direct continuation
			if len(target_node.children) == 0 and not target_node.is_system:
				common = 0
				while common < min(acc_len, req_len) and accumulated_tokens[common] == request_tokens[common]:
					common += 1
				if common >= int(acc_len * 0.75) and (acc_len - common) <= self.replace_tolerance and req_len >= common:
					parent_acc_len = len(target_node.parent.get_path_tokens()) if target_node.parent else 0
					new_delta = request_tokens[parent_acc_len:]
					prev_len = len(target_node.tokens)
					target_node.tokens = list(new_delta)
					target_node.state = new_state
					self.record_cache_hit(target_node, now)
					print(f"[PromptCache] Extended leaf node '{target_node.cache_id}' in-place from {prev_len} to {len(new_delta)} tokens (EMA: {target_node.ema_score:.2f}).")
					return

			# Branching: add Daughter 2 branch under target_node
			delta_tokens = request_tokens[acc_len:] if req_len > acc_len else []
			if delta_tokens:
				hija_2 = CacheTreeNode(
					tokens=delta_tokens,
					state=new_state,
					is_system=False,
					parent=target_node,
					cache_id=f"temporal_{int(now * 1000)}_{len(delta_tokens)}"
				)
				target_node.children.append(hija_2)
				self.enforce_max_caches()
				print(f"[PromptCache] Appended daughter branch '{hija_2.cache_id}' ({len(delta_tokens)} delta tokens) under '{target_node.cache_id}'. Active temporals: {len(self.temporal_caches)}.")
				return

		# Fallback: match against tree or append under root
		matched_node, matched_len = self.find_best_matching_node(None, request_tokens)
		parent_node = matched_node if matched_node else self.root
		delta = request_tokens[matched_len:] if req_len > matched_len else request_tokens
		new_node = CacheTreeNode(
			tokens=delta,
			state=new_state,
			is_system=False,
			parent=parent_node,
			cache_id=f"temporal_{int(now * 1000)}_{len(delta)}"
		)
		parent_node.children.append(new_node)
		self.enforce_max_caches()
		print(f"[PromptCache] Saved new branch '{new_node.cache_id}' ({len(delta)} tokens) under '{parent_node.cache_id}'. Active temporals: {len(self.temporal_caches)}.")

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

			# Attach or update Layer 1 System Prompt node in Radix Tree
			existing_node = None
			for child in self.root.children:
				if child.prompt_hash == prompt_hash or child.agent_name == agent_name:
					existing_node = child
					break

			if existing_node:
				existing_node.tokens = list(tokens)
				existing_node.state = state
				existing_node.last_used = time.time()
				self.ram_cache[prompt_hash] = existing_node
			else:
				sys_node = CacheTreeNode(
					tokens=tokens,
					state=state,
					is_system=True,
					parent=self.root,
					cache_id=f"sys_{agent_name}",
					agent_name=agent_name,
					prompt_hash=prompt_hash
				)
				self.root.children.append(sys_node)
				self.ram_cache[prompt_hash] = sys_node

			self.agent_hash_map[agent_name] = prompt_hash
			print(f"[PromptCache] Saved binary cache for '{agent_name}' ({prompt_hash}) to disk and RAM Radix Tree.")
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
			t_count = len(entry.tokens)
			kv_mb = round(t_count * 0.125, 2)
			total_temporal_ram_mb += kv_mb
			temporal_snapshots.append({
				"cache_id": entry.cache_id,
				"tokens": t_count,
				"total_mb": kv_mb,
				"last_used": entry.last_used
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

	def get_tree_structure(self) -> dict:
		root_dict = self.root.to_dict()
		root_dict["name"] = "Radix Tree (KV Cache RAM)"
		root_dict["data"] = f"Total System Prompts: {len(self.root.children)}, Max Caches: {self.max_caches}, TTL: {self.ttl_seconds}s"
		return root_dict


