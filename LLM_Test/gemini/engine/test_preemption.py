import time
import threading
from llama_cpp import Llama

model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-74701a8c35f6c8d9a4b91f3f3497643001d63e0c7a84e085bed452548fa88d45"

print("Loading model for preemption test...")
llm = Llama(
	model_path=model_path,
	n_ctx=1024,
	n_threads=4,
	verbose=False
)
print("Model loaded.")

high_priority_active = False
urgent_event = threading.Event()
urgent_done = threading.Event()

def low_priority_worker():
	global high_priority_active
	prompt = "Tell me a short story about an astronaut on Mars"
	max_tokens = 30
	texto_actual = prompt
	tokens_generados = 0
	pausas = 0
	print("[LOW] Started...")

	while tokens_generados < max_tokens:
		while high_priority_active:
			pausas += 1
			print("[LOW] Paused, waiting for urgent job...")
			time.sleep(0.1)

		tokens_restantes = max_tokens - tokens_generados
		print(f"[LOW] Generating chunk (remaining: {tokens_restantes})...")
		stream = llm(texto_actual, max_tokens=tokens_restantes, stream=True)

		motivo = None
		for chunk in stream:
			if high_priority_active:
				print("[LOW] Preempted by urgent job! Breaking stream...")
				break

			token = chunk["choices"][0]["text"]
			texto_actual += token
			tokens_generados += 1
			motivo = chunk["choices"][0].get("finish_reason")
			print(f"[LOW token {tokens_generados}]: {repr(token)}")

			# Trigger urgent job once low has generated 5 tokens
			if tokens_generados == 5 and not urgent_event.is_set():
				urgent_event.set()

			if motivo is not None:
				break

		if motivo is not None:
			break

	print(f"[LOW] Completed! Total tokens: {tokens_generados}, Pauses: {pausas}")
	print("[LOW Result]:", repr(texto_actual[len(prompt):]))


def urgent_worker():
	global high_priority_active
	urgent_event.wait()
	print("\n[URGENT] Triggered! Setting high_priority_active = True...")
	high_priority_active = True
	time.sleep(0.2)  # Give low priority thread time to stop token generation

	print("[URGENT] Running high priority generation with 100% CPU...")
	res = llm("Hello from urgent task!", max_tokens=8)
	print("[URGENT] Result:", repr(res["choices"][0]["text"]))

	print("[URGENT] Done! Lowering flag...")
	high_priority_active = False
	urgent_done.set()


t_low = threading.Thread(target=low_priority_worker)
t_urgent = threading.Thread(target=urgent_worker)

t_low.start()
t_urgent.start()

t_low.join()
t_urgent.join()
print("Test completed successfully!")
