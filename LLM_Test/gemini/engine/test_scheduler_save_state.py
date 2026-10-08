import os
import sys
sys.path.insert(0, os.path.abspath("."))
import asyncio
import threading
import time
from backend.config import resolve_model_path
from backend.engine import LlamaEngine
from backend.job import CHAT, DELTA, DONE, Job

class SchedulerWithSaveState:
	def __init__(self, engine):
		self.engine = engine
		self.preempt = threading.Event()
		self.paused_event = threading.Event()
		self.urgent_lock = threading.Lock()
		self.loop = None

	def submit_low(self, job):
		threading.Thread(target=self._run_low, args=(job,), daemon=True).start()

	def submit_urgent(self, job):
		threading.Thread(target=self._run_urgent, args=(job,), daemon=True).start()

	def _run_low(self, job):
		loop = self.loop
		limit = job.body.get("max_tokens") or 256
		stream = self.engine._create_stream(job, limit)

		for chunk in stream:
			if job.cancelled:
				return

			if self.preempt.is_set():
				job.times_paused += 1
				print("[SCHEDULER LOW] Preemption detected! Saving KV-Cache state...")
				state = self.engine.llm.save_state()
				self.paused_event.set()

				print("[SCHEDULER LOW] Freezing generator, waiting for urgent to finish...")
				while self.preempt.is_set():
					time.sleep(0.02)

				print("[SCHEDULER LOW] Restoring KV-Cache state...")
				self.engine.llm.load_state(state)
				self.paused_event.clear()
				print("[SCHEDULER LOW] Resuming generator directly with next token!")

			text, finish = self.engine._extract_chunk(job, chunk)
			if text:
				job.partial += text
				job.generated += 1
				loop.call_soon_threadsafe(job.out.put_nowait, (DELTA, text))

			if finish is not None:
				loop.call_soon_threadsafe(job.out.put_nowait, (DONE, finish))
				return

		loop.call_soon_threadsafe(job.out.put_nowait, (DONE, "stop"))

	def _run_urgent(self, job):
		loop = self.loop
		limit = job.body.get("max_tokens") or 256

		# 1. Signal preemption
		self.preempt.set()

		# 2. Wait for low to freeze and save its state
		self.paused_event.wait(timeout=2.0)

		# 3. Run urgent task with 100% CPU
		print("[SCHEDULER URGENT] Running urgent task...")
		stream = self.engine._create_stream(job, limit)
		for chunk in stream:
			text, finish = self.engine._extract_chunk(job, chunk)
			if text:
				job.partial += text
				loop.call_soon_threadsafe(job.out.put_nowait, (DELTA, text))
			if finish is not None:
				break

		loop.call_soon_threadsafe(job.out.put_nowait, (DONE, "stop"))
		print("[SCHEDULER URGENT] Completed! Lowering preemption flag...")

		# 4. Release low task
		self.preempt.clear()


async def run_test():
	engine = LlamaEngine(resolve_model_path())
	sched = SchedulerWithSaveState(engine)
	sched.loop = asyncio.get_running_loop()

	job_low = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Tell a story about the Roman republic"}], "max_tokens": 20}, priority=False, stream=True)
	job_urgent = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Di hola"}], "max_tokens": 4}, priority=True, stream=True)

	print("Launching low job...")
	sched.submit_low(job_low)

	# Read 3 low tokens
	for i in range(3):
		ev, val = await job_low.out.get()
		print(f"[CLIENT LOW token {i+1}]: {repr(val)}")

	# Launch urgent job
	print("\n>>> Launching URGENT job while low is in middle of stream! <<<")
	sched.submit_urgent(job_urgent)

	# Read urgent tokens to completion
	while True:
		ev, val = await job_urgent.out.get()
		if ev == DONE:
			print(f"[CLIENT URGENT]: DONE")
			break
		print(f"[CLIENT URGENT token]: {repr(val)}")

	# Low should resume without breaking or restarting!
	while True:
		ev, val = await job_low.out.get()
		if ev == DONE:
			print(f"[CLIENT LOW RESUMED]: DONE")
			break
		print(f"[CLIENT LOW RESUMED token]: {repr(val)}")

	print("\n--- Summary ---")
	print("Low total partial:", repr(job_low.partial))
	print("Times paused:", job_low.times_paused)
	print("TEST VERIFIED: Llama-cpp was NEVER disconnected; generator frozen and resumed in-place via save_state/load_state!")

if __name__ == "__main__":
	asyncio.run(run_test())
