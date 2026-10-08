import os
from typing import Tuple
from llama_cpp import Llama

from backend.config import N_CTX, N_CTX_HIGH, N_THREADS, resolve_model_path
from backend.job import CHAT, Job


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
			verbose=False,
		)
		self.llm_low = Llama(
			model_path=self.model_path,
			n_ctx=N_CTX,
			n_threads=N_THREADS,
			verbose=False,
		)

	def estimate_ram_mb(self, job: Job, max_tokens: int) -> float:
		try:
			llm = self.llm_high if job.priority else self.llm_low
			if job.kind == CHAT:
				prompt_text = " ".join(m.get("content", "") for m in job.body.get("messages", []))
			else:
				prompt_text = str(job.body.get("prompt", ""))
			prompt_tokens = len(llm.tokenize(prompt_text.encode("utf-8")))
		except Exception:
			prompt_tokens = 0
		return calcular_kv_ram_mb(prompt_tokens + max_tokens)

	def create_stream(self, job: Job):
		llm = self.llm_high if job.priority else self.llm_low
		limit = job.body.get("max_tokens") or job.body.get("max_completion_tokens") or 256
		messages = job.body.get("messages")
		if messages:
			return llm.create_chat_completion(
				messages=messages,
				max_tokens=limit,
				stream=True,
			)

		prompt = str(job.body.get("prompt", ""))
		return llm(
			prompt,
			max_tokens=limit,
			stream=True,
		)

	def extract_chunk(self, job: Job, chunk: dict) -> Tuple[str, str | None]:
		choice = chunk["choices"][0]
		if job.kind == CHAT:
			delta = choice.get("delta") or {}
			text = delta.get("content") or ""
		else:
			text = choice.get("text") or ""
		return text, choice.get("finish_reason")
