import os
import sys
sys.path.insert(0, os.path.abspath("."))
import asyncio
import threading
import time
from queue import Queue
from llama_cpp import Llama
from backend.config import resolve_model_path
from backend.job import CHAT, DELTA, DONE, Job

model_path = resolve_model_path()
llm_high = Llama(model_path=model_path, n_ctx=512, verbose=False)
llm_low = Llama(model_path=model_path, n_ctx=2048, verbose=False)

class PriorityTokenEngine:
	def __init__(self, llm_high, llm_low):
		self.llm_high = llm_high
		self.llm_low = llm_low
		self.high_queue = Queue()
		self.low_queue = Queue()
		self.current_high = None
		self.stream_high = None
		self.current_low = None
		self.stream_low = None
		self.running = True
		self.loop = None
		self.thread = threading.Thread(target=self._run_loop, daemon=True)
		self.thread.start()

	def submit(self, job: Job):
		if job.priority:
			self.high_queue.put(job)
		else:
			self.low_queue.put(job)

	def _create_stream(self, llm, job):
		messages = job.body.get("messages")
		limit = job.body.get("max_tokens", 256)
		if messages:
			return llm.create_chat_completion(messages=messages, max_tokens=limit, stream=True)
		prompt = job.body.get("prompt", "")
		return llm(prompt, max_tokens=limit, stream=True)

	def _extract_text_and_finish(self, job, chunk):
		choice = chunk["choices"][0]
		if job.kind == CHAT:
			delta = choice.get("delta") or {}
			text = delta.get("content") or ""
		else:
			text = choice.get("text") or ""
		return text, choice.get("finish_reason")

	def _run_loop(self):
		while self.running:
			# 1. Prioridad Alta (100% de la CPU)
			if self.current_high is not None or not self.high_queue.empty():
				if self.current_high is None:
					self.current_high = self.high_queue.get()
					self.stream_high = self._create_stream(self.llm_high, self.current_high)

				try:
					chunk = next(self.stream_high)
					text, finish = self._extract_text_and_finish(self.current_high, chunk)
					if text and self.loop:
						self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (DELTA, text))
					if finish is not None:
						if self.loop:
							self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (DONE, finish))
						self.current_high = None
						self.stream_high = None
				except StopIteration:
					if self.loop:
						self.loop.call_soon_threadsafe(self.current_high.out.put_nowait, (DONE, "stop"))
					self.current_high = None
					self.stream_high = None

			# 2. Prioridad Baja (solo avanza si no hay nada urgente)
			elif self.current_low is not None or not self.low_queue.empty():
				if self.current_low is None:
					self.current_low = self.low_queue.get()
					self.stream_low = self._create_stream(self.llm_low, self.current_low)

				try:
					chunk = next(self.stream_low)
					text, finish = self._extract_text_and_finish(self.current_low, chunk)
					if text and self.loop:
						self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (DELTA, text))
					if finish is not None:
						if self.loop:
							self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (DONE, finish))
						self.current_low = None
						self.stream_low = None
				except StopIteration:
					if self.loop:
						self.loop.call_soon_threadsafe(self.current_low.out.put_nowait, (DONE, "stop"))
					self.current_low = None
					self.stream_low = None

			# 3. Inactivo
			else:
				time.sleep(0.01)

async def test_full_interleaving():
	engine = PriorityTokenEngine(llm_high, llm_low)
	engine.loop = asyncio.get_running_loop()

	job_low = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Tell a long story about ancient Rome"}], "max_tokens": 15}, priority=False, stream=True)
	job_urgent = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Di hola"}], "max_tokens": 4}, priority=True, stream=True)

	print("Submitting low job...")
	engine.submit(job_low)

	# Read 3 tokens from low
	for i in range(3):
		ev, val = await job_low.out.get()
		print(f"[CLIENT LOW token {i+1}]: {repr(val)}")

	# Submit urgent job in middle of low stream!
	print("\n>>> Submitting URGENT job in middle of low stream! <<<")
	engine.submit(job_urgent)

	# Urgent should take over 100% of tokens until done!
	while True:
		ev, val = await job_urgent.out.get()
		if ev == DONE:
			print(f"[CLIENT URGENT]: DONE")
			break
		print(f"[CLIENT URGENT token]: {repr(val)}")

	# Low resumes from next token without any restart!
	while True:
		ev, val = await job_low.out.get()
		if ev == DONE:
			print(f"[CLIENT LOW RESUMED]: DONE")
			break
		print(f"[CLIENT LOW RESUMED token]: {repr(val)}")

	print("TEST TOKEN LOOP SUCCESSFUL!")

if __name__ == "__main__":
	asyncio.run(test_full_interleaving())
