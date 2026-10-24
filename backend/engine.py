from __future__ import annotations
import os
from typing import Tuple
from llama_cpp import Llama

from backend.config import FLASH_ATTN, N_CTX, N_CTX_HIGH, N_THREADS, resolve_model_path
from backend.job import CHAT, Job
from backend.prompt_cache import PromptCacheManager


def calcular_kv_ram_mb(n_tokens: int) -> float:
	MB_POR_TOKEN = 0.125
	return round(n_tokens * MB_POR_TOKEN, 2)


class LlamaEngine:
	def __init__(self, model_path: str | None = None):
		import time
		t_load_start = time.time()
		resolved = model_path or resolve_model_path()
		if not resolved or not os.path.exists(resolved):
			raise FileNotFoundError(f"GGUF model not found at path: {resolved}")
		self.model_path = resolved
		# Dual contexts: separate KV caches sharing read-only model weights via mmap
		self.llm_high = Llama(
			model_path=self.model_path,
			n_ctx=N_CTX_HIGH,
			n_threads=N_THREADS,
			flash_attn=FLASH_ATTN,
			verbose=False,
		)
		self.llm_low = Llama(
			model_path=self.model_path,
			n_ctx=N_CTX,
			n_threads=N_THREADS,
			flash_attn=FLASH_ATTN,
			verbose=False,
		)
		self.load_duration = round(time.time() - t_load_start, 3)
		self.last_restore_duration = 0.0
		# Initialize binary prompt cache and pre-warm known agents into RAM
		self.prompt_cache = PromptCacheManager()
		self.prompt_cache.warmup_defaults(self.llm_low)

	def count_prompt_tokens(self, job: Job) -> int:
		try:
			llm = self.llm_high if job.priority else self.llm_low
			if job.kind == CHAT:
				messages = job.body.get("messages", [])
				sys_msg = next((m for m in messages if m.get("role") == "system"), None)
				cached_sys_tokens = 0
				if sys_msg and sys_msg.get("content"):
					prompt_hash = self.prompt_cache.compute_hash(sys_msg["content"])
					cached_item = self.prompt_cache.ram_cache.get(prompt_hash)
					if cached_item and "tokens" in cached_item:
						cached_sys_tokens = len(cached_item["tokens"])

				user_text = " ".join(m.get("content", "") for m in messages if m.get("role") != "system")
				user_tokens = len(llm.tokenize(user_text.encode("utf-8"))) if user_text else 0
				return user_tokens if cached_sys_tokens > 0 else (user_tokens + cached_sys_tokens)
			else:
				prompt_text = str(job.body.get("prompt", ""))
				return len(llm.tokenize(prompt_text.encode("utf-8")))
		except Exception:
			return 0

	def estimate_ram_mb(self, job: Job, max_tokens: int) -> float:
		prompt_tokens = self.count_prompt_tokens(job)
		return calcular_kv_ram_mb(prompt_tokens + max_tokens)

	def create_stream(self, job: Job):
		llm = self.llm_high if job.priority else self.llm_low
		limit = job.body.get("max_tokens") or job.body.get("max_completion_tokens") or 256
		messages = job.body.get("messages")
		extra_params = {}
		if job.fast:
			extra_params["temperature"] = 0.0
			extra_params["top_k"] = 1
		else:
			if "temperature" in job.body:
				extra_params["temperature"] = float(job.body["temperature"])
			if "top_p" in job.body:
				extra_params["top_p"] = float(job.body["top_p"])

		if messages:
			tools = job.body.get("tools")
			if tools:
				extra_params["tools"] = tools
				extra_params["tool_choice"] = job.body.get("tool_choice") or "auto"

			# 1. Tokenize messages and tools exactly as formatted for the LLM
			request_tokens = self.prompt_cache.tokenize_messages(llm, messages, tools=tools)

			# 2. Find and apply the best matching cache (longest common identical token prefix)
			applied, used_cache, matched_count = self.prompt_cache.apply_best_cache(llm, request_tokens)
			print(
				f"[Engine Cache] Request tokens: {len(request_tokens)}, Applied cache: {applied}, "
				f"Matched prefix: {matched_count} tokens, Used cache: {used_cache.get('cache_id') if used_cache else None}",
				flush=True
			)

			stream = llm.create_chat_completion(
				messages=messages,
				max_tokens=limit,
				stream=True,
				**extra_params,
			)

			return self._wrap_stream_with_cache_update(llm, stream, used_cache, request_tokens, messages=messages, tools=tools)

		prompt = str(job.body.get("prompt", ""))
		return llm(
			prompt,
			max_tokens=limit,
			stream=True,
			**extra_params,
		)

	def _wrap_stream_with_cache_update(
		self,
		llm: Any,
		stream: Any,
		used_cache: Optional[dict],
		request_tokens: List[int],
		messages: Optional[list] = None,
		tools: Optional[list] = None
	):
		accumulated_text = ""
		try:
			for chunk in stream:
				try:
					choice = chunk.get("choices", [{}])[0]
					delta = choice.get("delta") or {}
					text = delta.get("content") or ""
					if text:
						accumulated_text += text
				except Exception:
					pass
				yield chunk
		finally:
			try:
				if hasattr(llm, "save_state") and request_tokens:
					final_state = llm.save_state()
					if messages and accumulated_text:
						full_msgs = list(messages) + [{"role": "assistant", "content": accumulated_text}]
						turn_tokens = self.prompt_cache.tokenize_messages(llm, full_msgs, tools=tools)
					else:
						turn_tokens = list(request_tokens)

					if turn_tokens:
						self.prompt_cache.save_or_replace_temporal_cache(used_cache, turn_tokens, final_state)
			except Exception as e:
				print(f"[Engine] Warning: Could not update temporal cache at end of stream: {e}", flush=True)

	def extract_chunk(self, job: Job, chunk: dict) -> Tuple[str | dict, str | None]:
		choice = chunk["choices"][0]
		if job.kind == CHAT:
			delta = choice.get("delta") or {}
			text = delta.get("content") or ""
			tool_calls = delta.get("tool_calls")
			reasoning = delta.get("reasoning_content") or delta.get("thinking")
			finish = choice.get("finish_reason")
			if tool_calls or reasoning:
				res = {"content": text}
				if tool_calls:
					res["tool_calls"] = tool_calls
				if reasoning:
					res["reasoning_content"] = reasoning
				return res, finish
			return text, finish
		else:
			text = choice.get("text") or ""
			return text, choice.get("finish_reason")

	def save_context_snapshot(self, snapshot_id: str = "caller", priority: bool = False) -> bool:
		llm = self.llm_high if priority else self.llm_low
		if hasattr(llm, "save_state"):
			try:
				state = llm.save_state()
				self.prompt_cache.save_snapshot(snapshot_id, state)
				return True
			except Exception as e:
				print(f"[Engine] Failed to save context snapshot '{snapshot_id}': {e}")
		return False

	def restore_context_snapshot(self, snapshot_id: str = "caller", priority: bool = False) -> bool:
		import time
		llm = self.llm_high if priority else self.llm_low
		state = self.prompt_cache.pop_snapshot(snapshot_id)
		if state and hasattr(llm, "load_state"):
			try:
				t0 = time.time()
				llm.load_state(state)
				self.last_restore_duration = round(time.time() - t0, 4)
				return True
			except Exception as e:
				print(f"[Engine] Failed to restore context snapshot '{snapshot_id}': {e}")
		return False

	def get_memory_stats(self, scheduler=None) -> dict:
		import os
		from backend.config import N_CTX, N_CTX_HIGH, FLASH_ATTN, N_THREADS

		# 1. Process RAM from OS
		rss_mb = 0.0
		vms_mb = 0.0
		try:
			import psutil
			proc = psutil.Process()
			mem = proc.memory_info()
			rss_mb = round(mem.rss / (1024 * 1024), 2)
			vms_mb = round(mem.vms / (1024 * 1024), 2)
		except Exception:
			if os.path.exists("/proc/self/status"):
				try:
					with open("/proc/self/status", "r") as f:
						for line in f:
							if line.startswith("VmRSS:"):
								rss_mb = round(float(line.split()[1]) / 1024.0, 2)
							elif line.startswith("VmSize:"):
								vms_mb = round(float(line.split()[1]) / 1024.0, 2)
				except Exception:
					pass

		# 2. Base Model info
		model_filename = os.path.basename(self.model_path) if self.model_path else "unknown"
		model_size_mb = 0.0
		if self.model_path and os.path.exists(self.model_path):
			model_size_mb = round(os.path.getsize(self.model_path) / (1024 * 1024), 2)

		# 3. Active KV Contexts
		high_max_tokens = N_CTX_HIGH
		high_max_kv_mb = calcular_kv_ram_mb(N_CTX_HIGH)
		high_current_tokens = 0
		high_current_kv_mb = 0.0
		if scheduler and getattr(scheduler, "current_high", None):
			high_current_tokens = scheduler.current_high.prompt_tokens + scheduler.current_high.generated
			high_current_kv_mb = calcular_kv_ram_mb(high_current_tokens)

		low_max_tokens = N_CTX
		low_max_kv_mb = calcular_kv_ram_mb(N_CTX)
		low_current_tokens = 0
		low_current_kv_mb = 0.0
		if scheduler and getattr(scheduler, "current_low", None):
			low_current_tokens = scheduler.current_low.prompt_tokens + scheduler.current_low.generated
			low_current_kv_mb = calcular_kv_ram_mb(low_current_tokens)

		# 4. Prompt Caches & Temporal Snapshots
		cache_breakdown = self.prompt_cache.get_memory_breakdown()

		return {
			"process": {
				"rss_mb": rss_mb,
				"vms_mb": vms_mb,
			},
			"model": {
				"filename": model_filename,
				"path": self.model_path,
				"file_size_mb": model_size_mb,
				"file_size_gb": round(model_size_mb / 1024.0, 2),
				"flash_attn": FLASH_ATTN,
				"threads": N_THREADS,
			},
			"active_contexts": {
				"high_priority": {
					"n_ctx_max": high_max_tokens,
					"max_kv_ram_mb": high_max_kv_mb,
					"active_tokens": high_current_tokens,
					"active_kv_ram_mb": high_current_kv_mb,
				},
				"low_priority": {
					"n_ctx_max": low_max_tokens,
					"max_kv_ram_mb": low_max_kv_mb,
					"active_tokens": low_current_tokens,
					"active_kv_ram_mb": low_current_kv_mb,
				},
				"total_allocated_kv_mb": round(high_max_kv_mb + low_max_kv_mb, 2)
			},
			"prompt_cache": cache_breakdown,
			"summary": {
				"total_ram_rss_mb": rss_mb,
				"model_weights_mb": model_size_mb,
				"prompt_caches_total_mb": cache_breakdown.get("prompt_caches_total_mb", 0.0),
				"temporal_snapshots_total_mb": cache_breakdown.get("temporal_snapshots_total_mb", 0.0),
			}
		}
