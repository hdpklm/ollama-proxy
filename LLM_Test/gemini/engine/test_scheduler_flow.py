import os
import sys
sys.path.insert(0, os.path.abspath("."))
import asyncio
import threading
import time
from backend.engine import LlamaEngine
from backend.job import CHAT, DELTA, DONE, Job
from backend.config import resolve_model_path

async def test_scheduler_flow():
	engine = LlamaEngine(resolve_model_path("llama3.2:1b"))
	loop = asyncio.get_running_loop()

	preempt_event = threading.Event()

	job_low = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Tell a story about Mars"}], "max_tokens": 20}, priority=False, stream=True)
	job_urgent = Job(kind=CHAT, body={"messages": [{"role": "user", "content": "Say Hi"}], "max_tokens": 5}, priority=True, stream=True)

	def run_worker(job):
		def is_preempted():
			return preempt_event.is_set()

		def wait_fn(t):
			time.sleep(t)

		for text, finish in engine.generate_stream(job, is_preempted, wait_fn):
			if text:
				loop.call_soon_threadsafe(job.out.put_nowait, (DELTA, text))
			if finish is not None:
				loop.call_soon_threadsafe(job.out.put_nowait, (DONE, finish))
				return

	# Start low in thread
	t_low = threading.Thread(target=run_worker, args=(job_low,))
	t_low.start()

	# Read 3 tokens
	for i in range(3):
		ev, val = await job_low.out.get()
		print(f"[CLIENT LOW token {i+1}]: {repr(val)}")

	# Set preemption
	print("[SIMULATION] Urgent job arrives! Setting preemption flag...")
	preempt_event.set()
	time.sleep(0.3)  # Give low priority thread time to break and enter wait mode

	# Run urgent job
	print("[SIMULATION] Running urgent job...")
	t_urgent = threading.Thread(target=run_worker, args=(job_urgent,))
	t_urgent.start()

	while True:
		ev, val = await job_urgent.out.get()
		if ev == DONE:
			print(f"[CLIENT URGENT]: DONE ({val})")
			break
		print(f"[CLIENT URGENT token]: {repr(val)}")
	t_urgent.join()

	print("[SIMULATION] Urgent job done! Lowering preemption flag...")
	preempt_event.clear()

	# Low job resumes automatically
	while True:
		ev, val = await job_low.out.get()
		if ev == DONE:
			print(f"[CLIENT LOW RESUMED]: DONE ({val})")
			break
		print(f"[CLIENT LOW RESUMED token]: {repr(val)}")
	t_low.join()

	print(f"Final low text: {repr(job_low.partial)}")
	print("Scheduler flow test passed!")

asyncio.run(test_scheduler_flow())
