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
			sys_msg = next((m for m in messages if m.get("role") == "system"), None)
			if sys_msg and sys_msg.get("content"):
				self.prompt_cache.apply_cache_if_available(llm, sys_msg["content"])

			if "tools" in job.body and job.body["tools"]:
				extra_params["tools"] = job.body["tools"]
				extra_params["tool_choice"] = job.body.get("tool_choice") or "auto"

			return llm.create_chat_completion(
				messages=messages,
				max_tokens=limit,
				stream=True,
				**extra_params,
			)

		prompt = str(job.body.get("prompt", ""))
		return llm(
			prompt,
			max_tokens=limit,
			stream=True,
			**extra_params,
		)

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
