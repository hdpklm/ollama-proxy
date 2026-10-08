import asyncio
import threading
import time
from llama_cpp import Llama

model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-74701a8c35f6c8d9a4b91f3f3497643001d63e0c7a84e085bed452548fa88d45"

llm = Llama(model_path=model_path, n_ctx=1024, n_threads=4, verbose=False)

high_priority_active = False
resume_event = threading.Event()
resume_event.set()

async def main():
	loop = asyncio.get_running_loop()
	low_queue = asyncio.Queue()
	urgent_queue = asyncio.Queue()

	def run_low():
		global high_priority_active
		prompt = "Story of a space station"
		limit = 25
		generated = 0
		partial = prompt
		while generated < limit:
			while high_priority_active:
				resume_event.wait()

			tokens_remaining = limit - generated
			stream = llm(partial, max_tokens=tokens_remaining, stream=True)
			interrupted = False
			for chunk in stream:
				if high_priority_active:
					interrupted = True
					break
				t = chunk["choices"][0]["text"]
				partial += t
				generated += 1
				loop.call_soon_threadsafe(low_queue.put_nowait, ("DELTA", t))
			if not interrupted:
				loop.call_soon_threadsafe(low_queue.put_nowait, ("DONE", "stop"))
				return

	def run_urgent():
		global high_priority_active
		high_priority_active = True
		resume_event.clear()
		time.sleep(0.15) # Wait for low to stop

		stream = llm("Urgent alert!", max_tokens=6, stream=True)
		for chunk in stream:
			t = chunk["choices"][0]["text"]
			loop.call_soon_threadsafe(urgent_queue.put_nowait, ("DELTA", t))
		loop.call_soon_threadsafe(urgent_queue.put_nowait, ("DONE", "stop"))

		high_priority_active = False
		resume_event.set()

	# Start low thread
	t_low = threading.Thread(target=run_low)
	t_low.start()

	# Receive 5 low tokens
	for _ in range(5):
		ev, val = await low_queue.get()
		print(f"[ASYNC LOW]: {repr(val)}")

	# Trigger urgent
	print("[ASYNC] Launching urgent thread...")
	t_urgent = threading.Thread(target=run_urgent)
	t_urgent.start()

	# Consume urgent
	while True:
		ev, val = await urgent_queue.get()
		if ev == "DONE":
			print("[ASYNC URGENT]: DONE")
			break
		print(f"[ASYNC URGENT]: {repr(val)}")

	# Continue consuming low
	while True:
		ev, val = await low_queue.get()
		if ev == "DONE":
			print("[ASYNC LOW]: DONE")
			break
		print(f"[ASYNC LOW RESUMED]: {repr(val)}")

	t_low.join()
	t_urgent.join()
	print("Async bridge test successful!")

asyncio.run(main())
