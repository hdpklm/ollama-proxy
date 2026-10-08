import os
from typing import Callable, Generator, Tuple
from llama_cpp import Llama, llama_chat_format

from backend.config import N_CTX, N_THREADS, resolve_model_path
from backend.job import CHAT, COMPLETION, GENERATE, Job


def calcular_kv_ram_mb(n_tokens: int) -> float:
	MB_POR_TOKEN = 0.125
	return round(n_tokens * MB_POR_TOKEN, 2)


class LlamaEngine:
	def __init__(self, model_path: str | None = None):
		resolved = model_path or resolve_model_path()
		if not resolved or not os.path.exists(resolved):
			raise FileNotFoundError(f"GGUF model not found at path: {resolved}")
		self.model_path = resolved
		self.llm = Llama(
			model_path=self.model_path,
			n_ctx=N_CTX,
			n_threads=N_THREADS,
			verbose=False,
		)
		self.formatter = None
		template = self.llm.metadata.get("tokenizer.chat_template")
		if template:
			try:
				self.formatter = llama_chat_format.Jinja2ChatFormatter(
					template=template,
					eos_token=self.llm.token_get_text(self.llm.token_eos()),
					bos_token=self.llm.token_get_text(self.llm.token_bos()),
				)
			except Exception:
				self.formatter = None

	def format_chat(self, messages: list[dict]) -> str:
		if self.formatter:
			try:
				res = self.formatter(messages=messages)
				prompt = res.prompt
				if prompt.startswith("<bos>"):
					prompt = prompt[5:]
				return prompt
			except Exception:
				pass

		parts = []
		for m in messages:
			role = m.get("role", "user")
			content = m.get("content", "")
			parts.append(f"{role.capitalize()}: {content}")
		parts.append("Assistant:")
		return "\n\n".join(parts) + " "

	def estimate_ram_mb(self, job: Job, max_tokens: int) -> float:
		try:
			if job.kind == CHAT:
				prompt_text = " ".join(m.get("content", "") for m in job.body.get("messages", []))
			else:
				prompt_text = str(job.body.get("prompt", ""))
			prompt_tokens = len(self.llm.tokenize(prompt_text.encode("utf-8")))
		except Exception:
			prompt_tokens = 0
		return calcular_kv_ram_mb(prompt_tokens + max_tokens)

	def _create_stream(self, job: Job, max_tokens: int):
		if not job.prompt:
			if job.kind == CHAT:
				job.prompt = self.format_chat(job.body.get("messages", []))
			else:
				job.prompt = str(job.body.get("prompt", ""))

		# Continuous prompt: base prompt + whatever partial text has been generated so far
		full_prompt = job.prompt + job.partial

		return self.llm(
			full_prompt,
			max_tokens=max_tokens,
			stream=True,
		)

	def _extract_chunk(self, job: Job, chunk: dict) -> Tuple[str, str | None]:
		choice = chunk["choices"][0]
		text = choice.get("text") or ""
		return text, choice.get("finish_reason")

	def generate_stream(
		self,
		job: Job,
		is_preempted_fn: Callable[[], bool],
		wait_fn: Callable[[float], None],
	) -> Generator[Tuple[str, str | None], None, None]:
		limit = job.body.get("max_tokens") or job.body.get("max_completion_tokens") or 256
		job.kv_cache_ram_mb = self.estimate_ram_mb(job, limit)

		# Urgent / High priority route: runs with full CPU without interruption check
		if job.priority:
			stream = self._create_stream(job, limit)
			for chunk in stream:
				if job.cancelled:
					return
				text, finish = self._extract_chunk(job, chunk)
				if text:
					job.partial += text
					job.generated += 1
					yield text, None
				if finish is not None:
					yield "", finish
					return
			yield "", "stop"
			return

		# Low priority route: cooperative token-level interruption
		while job.generated < limit:
			if job.cancelled:
				return

			# If a high-priority job is active, wait
			while is_preempted_fn():
				if job.cancelled:
					return
				job.times_paused += 1
				wait_fn(0.1)

			tokens_remaining = limit - job.generated
			stream = self._create_stream(job, tokens_remaining)

			interrupted = False
			finish_reason = None

			for chunk in stream:
				if job.cancelled:
					return

				if is_preempted_fn():
					job.times_paused += 1
					interrupted = True
					break

				text, finish_reason = self._extract_chunk(job, chunk)
				if text:
					job.partial += text
					job.generated += 1
					yield text, None

				if finish_reason is not None:
					break

			if not interrupted or finish_reason is not None:
				yield "", finish_reason or "stop"
				return
