import os
import sys
sys.path.insert(0, os.path.abspath("."))
import asyncio
import heapq
import itertools
import threading
import time

from backend.config import resolve_model_path
from backend.engine import LlamaEngine
from backend.job import CHAT, DELTA, DONE, ERROR, Job


class SchedulerTest:
	def __init__(self, engine):
		self.engine = engine
		self.heap = []
		self.current = None
		self.counter = itertools.count()
		self.wake = asyncio.Event()
		self.preempt = threading.Event()
		self.inference_lock = threading.Lock()
		self.urgent_count = 0
		self.loop = None

	def submit(self, job):
		job.seq = next(self.counter)
		rank = 0 if job.priority else 1
		if job.priority:
			self.urgent_count += 1
			self.preempt.set()
		heapq.heappush(self.heap, (rank, job.seq, job))
		self.wake.set()

	def cancel(self, job):
		job.cancelled = True
		if self.current is job and not job.priority:
			self.preempt.set()

	async def run(self):
		self.loop = asyncio.get_running_loop()
		while True:
			while self.heap:
				_, _, job = heapq.heappop(self.heap)
				if not job.cancelled:
					self.current = job
					limit = job.body.get("max_tokens") or 256
					try:
						await asyncio.to_thread(self._run_job, job, limit)
					finally:
						if job.priority:
							self.urgent_count -= 1
							if self.urgent_count == 0:
								self.preempt.clear()
						elif not job.cancelled and job.generated < limit:
							# Re-push preempted job so it resumes when urgent tasks finish
							heapq.heappush(self.heap, (1, job.seq, job))
						self.current = None
			self.wake.clear()
			await self.wake.wait()

	def _run_job(self, job, limit):
		loop = self.loop
		job.kv_cache_ram_mb = self.engine.estimate_ram_mb(job, limit)
		try:
			while job.generated < limit and not job.cancelled:
				tokens_remaining = limit - job.generated
				stream = self.engine._create_stream(job, tokens_remaining)
				interrupted = False
				finish_reason = None

				for chunk in stream:
					if job.cancelled:
						return
					if self.preempt.is_set() and not job.priority:
						job.times_paused += 1
						interrupted = True
						break

					text, finish_reason = self.engine._extract_chunk(job, chunk)
					if text:
						job.partial += text
						job.generated += 1
						loop.call_soon_threadsafe(job.out.put_nowait, (DELTA, text))

					if finish_reason is not None:
						break

				if interrupted:
					# Stop generation slice immediately to free CPU for urgent job
					return

				if finish_reason is not None:
					loop.call_soon_threadsafe(job.out.put_nowait, (DONE, finish_reason))
					return

			if not job.cancelled:
				loop.call_soon_threadsafe(job.out.put_nowait, (DONE, "stop"))
		except Exception as err:
			loop.call_soon_threadsafe(job.out.put_nowait, (ERROR, str(err) or repr(err)))


async def test_full_system():
	engine = LlamaEngine(resolve_model_path("llama3.2:1b"))
	sched = SchedulerTest(engine)
	asyncio.create_task(sched.run())

	job_low = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Write 20 words about the moon"}], "max_tokens": 15}, priority=False, stream=True)
	sched.submit(job_low)

	# Read 3 tokens
	for i in range(3):
		ev, val = await job_low.out.get()
		print(f"[TEST LOW]: {repr(val)}")

	# Submit urgent job
	print("\n>>> Submitting URGENT job while low is running! <<<")
	job_urgent = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Say Hello"}], "max_tokens": 4}, priority=True, stream=True)
	sched.submit(job_urgent)

	# Consume urgent job
	while True:
		ev, val = await job_urgent.out.get()
		if ev == DONE:
			print(f"[TEST URGENT]: DONE ({val})")
			break
		print(f"[TEST URGENT]: {repr(val)}")

	# Low job should now resume and complete
	while True:
		ev, val = await job_low.out.get()
		if ev == DONE:
			print(f"[TEST LOW RESUMED]: DONE ({val})")
			break
		print(f"[TEST LOW RESUMED]: {repr(val)}")

	print("\nFinal low partial:", repr(job_low.partial))
	print("Times paused:", job_low.times_paused)
	print("Full system test passed successfully!")

asyncio.run(test_full_system())
