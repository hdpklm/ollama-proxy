from __future__ import annotations
import os
import glob
import hashlib
import pickle
import traceback
from typing import Dict, Any, Optional

try:
	from backend.config import PROMPT_CACHE_DIR
except ImportError:
	PROMPT_CACHE_DIR = os.getenv("PROMPT_CACHE_DIR", "./cache/prompt_states")

def _parse_and_get_effective_prompt(content: str) -> str:
	trimmed = content.strip()
	if not trimmed.startswith("---"):
		return content

	parts = trimmed.split("---", 2)
	if len(parts) < 3:
		return content

	yaml_text = parts[1]
	body_text = parts[2].strip()

	try:
		import yaml
		metadata = yaml.safe_load(yaml_text) or {}
	except Exception:
		metadata = {}

	tools_config = metadata.get("tools") or {}
	if not tools_config:
		return body_text

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
	return body_text + "\n" + "\n".join(guidelines)

def load_all_agent_prompts() -> Dict[str, str]:
	prompts: Dict[str, str] = {
		"main_agent": "Eres un asistente conversacional inteligente, conciso y directo en español.",
		"researcher": "Eres un sub-agente especialista en investigación y análisis factual riguroso.",
		"coder": "Eres un sub-agente ingeniero de software senior.",
		"writer": "Eres un sub-agente especialista en redacción ejecutiva y comunicación clara."
	}

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
							effective_content = _parse_and_get_effective_prompt(raw_content)
							if stem in ("system_prompt", "main", "main_agent"):
								prompts["main_agent"] = effective_content
							else:
								prompts[stem] = effective_content
				except Exception:
					pass
	return prompts

DEFAULT_AGENT_PROMPTS: Dict[str, str] = load_all_agent_prompts()


class PromptCacheManager:
	def __init__(self, cache_dir: str | None = None, configured_prompts: Dict[str, str] | None = None):
		self.cache_dir = cache_dir or os.getenv("PROMPT_CACHE_DIR", "./cache/prompt_states")
		os.makedirs(self.cache_dir, exist_ok=True)
		self.configured_prompts: Dict[str, str] = configured_prompts if configured_prompts is not None else DEFAULT_AGENT_PROMPTS
		# In-memory RAM cache: hash -> cached payload dictionary
		self.ram_cache: Dict[str, Dict[str, Any]] = {}
		# Agent to current hash mapping: agent_name -> current_hash
		self.agent_hash_map: Dict[str, str] = {}
		# In-memory caller context snapshots: snapshot_id -> saved LlamaState
		self.ram_snapshots: Dict[str, Any] = {}
		self.load_configured_to_ram()

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
	def compute_hash(prompt_text: str) -> str:
		clean_text = prompt_text.strip()
		return hashlib.sha256(clean_text.encode("utf-8")).hexdigest()[:16]

	def get_cache_filepath(self, agent_name: str, prompt_hash: str) -> str:
		return os.path.join(self.cache_dir, f"{agent_name}_{prompt_hash}.bin")

	def load_configured_to_ram(self):
		loaded_count = 0
		prompts_to_load = self.configured_prompts or DEFAULT_AGENT_PROMPTS

		for agent_name, prompt_text in prompts_to_load.items():
			expected_hash = self.compute_hash(prompt_text)
			self.remove_stale_agent_cache(agent_name, expected_hash)
			filepath = self.get_cache_filepath(agent_name, expected_hash)

			if os.path.exists(filepath):
				try:
					with open(filepath, "rb") as f:
						data = pickle.load(f)
					prompt_hash = data.get("hash")
					if prompt_hash == expected_hash and "state" in data:
						self.ram_cache[prompt_hash] = data
						self.agent_hash_map[agent_name] = prompt_hash
						loaded_count += 1
				except Exception as e:
					print(f"[PromptCache] Failed to load binary cache '{filepath}': {e}")

		print(f"[PromptCache] Pre-loaded {loaded_count} configured binary prompt caches into RAM.")

	def load_all_to_ram(self):
		return self.load_configured_to_ram()

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

	def get_cached_state_by_hash(self, prompt_hash: str) -> Optional[Any]:
		cached = self.ram_cache.get(prompt_hash)
		if cached:
			return cached.get("state")
		return None

	def save_cache(self, agent_name: str, prompt_text: str, state: Any, tokens: list) -> str:
		prompt_hash = self.compute_hash(prompt_text)
		self.remove_stale_agent_cache(agent_name, prompt_hash)

		filepath = self.get_cache_filepath(agent_name, prompt_hash)
		payload = {
			"agent_name": agent_name,
			"hash": prompt_hash,
			"tokens": tokens,
			"state": state
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

	def identify_agent_name(self, prompt_text: str) -> str:
		prompt_hash = self.compute_hash(prompt_text)
		prompts_dict = self.configured_prompts or DEFAULT_AGENT_PROMPTS
		for agent_name, text in prompts_dict.items():
			if self.compute_hash(text) == prompt_hash:
				return agent_name
		for agent_name, stored_hash in self.agent_hash_map.items():
			if stored_hash == prompt_hash:
				return agent_name
		return f"agent_{prompt_hash[:8]}"

	def get_chat_formatted_system_prompt(self, llm: Any, prompt_text: str) -> Optional[str]:
		try:
			handler = getattr(llm, "chat_handler", None)
			if not handler and hasattr(llm, "_chat_handlers"):
				chat_fmt = getattr(llm, "chat_format", "chat_template.default")
				handler = llm._chat_handlers.get(chat_fmt) or llm._chat_handlers.get("chat_template.default")
			if handler and hasattr(handler, "__closure__") and handler.__closure__:
				formatter = handler.__closure__[0].cell_contents
				if callable(formatter):
					res = formatter(messages=[{"role": "system", "content": prompt_text}])
					raw_prompt = getattr(res, "prompt", str(res))
					for delimiter in (
						"<|turn>model\n",
						"<|im_start|>assistant\n",
						"<start_of_turn>model\n",
						"<|start_header_id|>assistant<|end_header_id|>\n\n",
						"[INST]"
					):
						if delimiter in raw_prompt:
							return raw_prompt.split(delimiter)[0]
					return raw_prompt
		except Exception as e:
			print(f"[PromptCache] Notice: Chat formatter extraction fallback: {e}")
		return None

	def warmup_defaults(self, llm: Any):
		if not llm:
			return

		print("[PromptCache] Warming up default agent system prompt caches...")
		prompts_to_warm = self.configured_prompts or DEFAULT_AGENT_PROMPTS
		for agent_name, prompt_text in prompts_to_warm.items():
			prompt_hash = self.compute_hash(prompt_text)
			if prompt_hash in self.ram_cache:
				continue

			try:
				if hasattr(llm, "reset"):
					llm.reset()
				formatted_sys = self.get_chat_formatted_system_prompt(llm, prompt_text)
				if formatted_sys and hasattr(llm, "tokenize"):
					tokens = llm.tokenize(formatted_sys.encode("utf-8"), add_bos=False)
				else:
					tokens = llm.tokenize(prompt_text.encode("utf-8")) if hasattr(llm, "tokenize") else []

				if tokens and hasattr(llm, "eval"):
					llm.eval(tokens)
				if hasattr(llm, "save_state"):
					state = llm.save_state()
					self.save_cache(agent_name, prompt_text, state, tokens)
			except Exception as e:
				print(f"[PromptCache] Warning: Could not pre-evaluate '{agent_name}': {e}")

	def apply_cache_if_available(self, llm: Any, prompt_text: str) -> bool:
		prompt_hash = self.compute_hash(prompt_text)
		cached_state = self.get_cached_state_by_hash(prompt_hash)
		if cached_state and hasattr(llm, "load_state"):
			try:
				llm.load_state(cached_state)
				return True
			except Exception as e:
				print(f"[PromptCache] Error loading cached state for hash {prompt_hash}: {e}")
		return False

	def get_memory_breakdown(self) -> dict:
		prompt_caches = []
		total_prompt_cache_ram_mb = 0.0

		for h, data in self.ram_cache.items():
			token_count = len(data.get("tokens", []))
			state = data.get("state")
			state_bytes = 0
			if state is not None:
				try:
					import sys
					state_bytes = sys.getsizeof(state)
				except Exception:
					pass
			# KV cache memory formula: 0.125 MB per token
			kv_mb = round(token_count * 0.125, 2)
			allocated_mb = max(kv_mb, round(state_bytes / (1024 * 1024), 2))
			total_prompt_cache_ram_mb += allocated_mb
			prompt_caches.append({
				"agent_name": data.get("agent_name", "custom"),
				"hash": h,
				"tokens": token_count,
				"kv_ram_mb": kv_mb,
				"total_mb": round(allocated_mb, 2)
			})

		temporal_snapshots = []
		total_temporal_ram_mb = 0.0
		for snap_id, state in self.ram_snapshots.items():
			snap_bytes = 0
			if state is not None:
				try:
					import sys
					snap_bytes = sys.getsizeof(state)
				except Exception:
					pass
			snap_mb = round(snap_bytes / (1024 * 1024), 2)
			# Fallback minimum estimate for active Llama state context
			if snap_mb < 0.1:
				snap_mb = 16.0
			total_temporal_ram_mb += snap_mb
			temporal_snapshots.append({
				"snapshot_id": snap_id,
				"total_mb": round(snap_mb, 2)
			})

		return {
			"prompt_caches": prompt_caches,
			"prompt_caches_total_mb": round(total_prompt_cache_ram_mb, 2),
			"prompt_caches_count": len(prompt_caches),
			"temporal_snapshots": temporal_snapshots,
			"temporal_snapshots_total_mb": round(total_temporal_ram_mb, 2),
			"temporal_snapshots_count": len(temporal_snapshots),
		}
