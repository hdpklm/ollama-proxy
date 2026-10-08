import os
import sys
sys.path.insert(0, os.path.abspath("."))
import time
sys.stdout.reconfigure(encoding="utf-8")
from llama_cpp import Llama
from backend.config import resolve_model_path

model_path = resolve_model_path()

print("Testing Option 1: Shared model via Llama._internals or LlamaContext...")
# Check if Llama has .model attribute
llm_base = Llama(model_path=model_path, n_ctx=512, verbose=False)
print("llm_base model:", getattr(llm_base, "_model", None) or getattr(llm_base, "model", None))

# Check Option 2: Two Llama instances with mmap
llm_low = Llama(model_path=model_path, n_ctx=1024, verbose=False)
llm_high = Llama(model_path=model_path, n_ctx=512, verbose=False)

print("Both instances loaded successfully!")

# Test interleaving tokens between stream_low and stream_high!
stream_low = llm_low("Tell a story about Mars", max_tokens=10, stream=True)
stream_high = llm_high("Say Hi", max_tokens=3, stream=True)

print("Testing round-robin / priority loop:")
active_high = stream_high
active_low = stream_low

while active_high or active_low:
	if active_high:
		try:
			chunk = next(active_high)
			t = chunk["choices"][0]["text"]
			print(f"[HIGH TOKEN]: {repr(t)}")
			if chunk["choices"][0].get("finish_reason") is not None:
				active_high = None
		except StopIteration:
			active_high = None
	elif active_low:
		try:
			chunk = next(active_low)
			t = chunk["choices"][0]["text"]
			print(f"[LOW TOKEN]: {repr(t)}")
			if chunk["choices"][0].get("finish_reason") is not None:
				active_low = None
		except StopIteration:
			active_low = None

print("DUAL STREAM TEST COMPLETED SUCCESSFULLY!")
