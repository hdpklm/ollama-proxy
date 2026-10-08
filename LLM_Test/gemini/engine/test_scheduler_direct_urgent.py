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
from backend.job import CHAT, DELTA, DONE, Job

class SchedulerDirectUrgent:
	def __init__(self, engine):
		self.engine = engine
		self.heap = []
		self.current = None
		self.counter = itertools.count()
		self.wake = asyncio.Event()
		self.preempt = threading.Event()
		self.paused_event = threading.Event()
		self.loop = None

	def submit(self, job):
		job.seq = next(self.counter)
		if job.priority:
			# If urgent job arrives, launch it immediately in thread
			print("[SCHEDULER] Urgent job arrived! Launching immediate execution...")
			asyncio.create_task(asyncio.to_thread(self._run_urgent_job, job))
		else:
			heapq.heappush(self.heap, (1, job.seq, job))
			self.wake.set()

	async def run(self):
		self.loop = asyncio.get_running_loop()
		while True:
			while self.heap:
				_, _, job = heapq.heappop(self.heap)
				if not job.cancelled:
					self.current = job
					limit = job.body.get("max_tokens") or 256
					try:
						await asyncio.to_thread(self._run_low_job, job, limit)
					finally:
						self.current = None
			self.wake.clear()
			await self.wake.wait()

	def _run_urgent_job(self, job):
		loop = self.loop
		limit = job.body.get("max_tokens") or 256
		job.kv_cache_ram_mb = self.engine.estimate_ram_mb(job, limit)

		# 1. Signal preemption
		self.preempt.set()
		# 2. Wait until low job pauses and saves KV cache
		if self.current and not self.current.priority:
			self.paused_event.wait(timeout=2.0)

		try:
			print("[URGENT] Running...")
			stream = self.engine._create_stream(job, limit)
			for chunk in stream:
				text, finish = self.engine._extract_chunk(job, chunk)
				if text:
					job.partial += text
					if loop:
						loop.call_soon_threadsafe(job.out.put_nowait, (DELTA, text))
				if finish is not None:
					break
			if loop:
				loop.call_soon_threadsafe(job.out.put_nowait, (DONE, "stop"))
			print("[URGENT] Finished!")
		finally:
			# 3. Release low job
			self.preempt.clear()

	def _run_low_job(self, job, limit):
		loop = self.loop
		job.kv_cache_ram_mb = self.engine.estimate_ram_mb(job, limit)
		try:
			stream = self.engine._create_stream(job, limit)
			for chunk in stream:
				if job.cancelled:
					return

				if self.preempt.is_set():
					job.times_paused += 1
					print("[LOW] Preempted! Freezing generator and saving KV cache...")
					state = self.engine.llm.save_state()
					self.paused_event.set()

					while self.preempt.is_set():
						time.sleep(0.02)

					print("[LOW] Resuming generator and restoring KV cache...")
					self.engine.llm.load_state(state)
					self.paused_event.clear()

				text, finish = self.engine._extract_chunk(job, chunk)
				if text:
					job.partial += text
					job.generated += 1
					if loop:
						loop.call_soon_threadsafe(job.out.put_nowait, (DELTA, text))

				if finish is not None:
					if loop:
						loop.call_soon_threadsafe(job.out.put_nowait, (DONE, finish))
					return

			if not job.cancelled and loop:
				loop.call_soon_threadsafe(job.out.put_nowait, (DONE, "stop"))
		except Exception as err:
			if loop:
				loop.call_soon_threadsafe(job.out.put_nowait, (ERROR, str(err)))

async def test_flow():
	engine = LlamaEngine(resolve_model_path())
	sched = SchedulerDirectUrgent(engine)
	asyncio.create_task(sched.run())

	job_low = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Tell a story about ancient Rome"}], "max_tokens": 15}, priority=False, stream=True)
	job_urgent = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Di hola"}], "max_tokens": 3}, priority=True, stream=True)

	sched.submit(job_low)

	for i in range(3):
		ev, val = await job_low.out.get()
		print(f"[CLIENT LOW]: {repr(val)}")

	sched.submit(job_urgent)

	while True:
		ev, val = await job_urgent.out.get()
		if ev == DONE:
			print(f"[CLIENT URGENT]: DONE")
			break
		print(f"[CLIENT URGENT]: {repr(val)}")

	while True:
		ev, val = await job_low.out.get()
		if ev == DONE:
			print(f"[CLIENT LOW RESUMED]: DONE")
			break
		print(f"[CLIENT LOW RESUMED]: {repr(val)}")

	print("Final low text:", repr(job_low.partial))
	print("Times paused:", job_low.times_paused)
	print("DIRECT URGENT TEST PASSED!")

if __name__ == "__main__":
	asyncio.run(test_flow())
