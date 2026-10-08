import os
import sys
sys.path.insert(0, os.path.abspath("."))
from llama_cpp import Llama
from backend.config import resolve_model_path

llm = Llama(resolve_model_path(), verbose=False)

print("Starting generation A...")
stream_a = llm("Tell a story about Rome", max_tokens=10, stream=True)

for i in range(3):
	chunk = next(stream_a)
	print(f"Token A {i+1}: {repr(chunk['choices'][0]['text'])}")

print("Saving state of A...")
state_a = llm.save_state()

print("Running Urgent B...")
res_b = llm("Di hola", max_tokens=3)
print("Urgent B result:", repr(res_b["choices"][0]["text"]))

print("Restoring state of A...")
llm.load_state(state_a)

print("Attempting to continue stream A...")
try:
	for chunk in stream_a:
		print(f"Token A resumed: {repr(chunk['choices'][0]['text'])}")
	print("SUCCESS: Stream A resumed directly with next()!")
except Exception as e:
	print("ERROR continuing stream A:", e)
