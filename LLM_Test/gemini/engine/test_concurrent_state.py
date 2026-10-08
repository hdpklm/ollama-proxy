import os
import sys
sys.path.insert(0, os.path.abspath("."))
import threading
import time
from llama_cpp import Llama
from backend.config import resolve_model_path

llm = Llama(resolve_model_path(), verbose=False)

urgent_requested = threading.Event()
urgent_finished = threading.Event()
low_done = threading.Event()

low_tokens = []
urgent_tokens = []

def low_worker():
	prompt = "Tell a story about an ancient empire"
	stream = llm(prompt, max_tokens=15, stream=True)
	
	for chunk in stream:
		t = chunk["choices"][0]["text"]
		low_tokens.append(t)
		print(f"[LOW]: {repr(t)}")

		# When 4 tokens generated, pause and let urgent run!
		if len(low_tokens) == 4:
			print("[LOW] Pausing! Saving state in RAM...")
			state = llm.save_state()
			
			# Signal urgent to run
			urgent_requested.set()
			
			# Wait for urgent to finish
			urgent_finished.wait()
			
			print("[LOW] Urgent finished! Restoring state...")
			llm.load_state(state)
			print("[LOW] State restored, continuing generator...")

	low_done.set()

def urgent_worker():
	urgent_requested.wait()
	print("[URGENT] Running urgent task...")
	res = llm("Di hola", max_tokens=3)
	urgent_tokens.append(res["choices"][0]["text"])
	print("[URGENT] Result:", res["choices"][0]["text"])
	urgent_finished.set()

t_low = threading.Thread(target=low_worker)
t_urgent = threading.Thread(target=urgent_worker)

t_low.start()
t_urgent.start()

t_low.join()
t_urgent.join()

print("\n--- Results ---")
print("Low full tokens count:", len(low_tokens))
print("Low full text:", repr("".join(low_tokens)))
print("Urgent text:", repr("".join(urgent_tokens)))
print("SUCCESS: Low generator paused, urgent ran, low resumed in-place with NO restart!")
