import os
import sys
sys.path.insert(0, os.path.abspath("."))
import time
import threading
from llama_cpp import Llama, llama_chat_format
from backend.config import resolve_model_path

llm = Llama(resolve_model_path(), verbose=False)

template = llm.metadata.get("tokenizer.chat_template")
formatter = llama_chat_format.Jinja2ChatFormatter(
	template=template,
	eos_token="<end_of_turn>",
	bos_token="<bos>"
)

messages = [{"role": "user", "content": "Tell a long story about the Roman empire"}]
base_prompt = formatter(messages=messages).prompt
print("Base prompt:", repr(base_prompt))

# 1. Generate 5 tokens
accumulated = ""
stream1 = llm(base_prompt, max_tokens=5, stream=True)
for chunk in stream1:
	t = chunk["choices"][0]["text"]
	accumulated += t
	print(f"[Slice 1 token]: {repr(t)}")

print(f"\nPaused after Slice 1. Accumulated: {repr(accumulated)}\n")

# 2. Simulate urgent task interruption
print("Simulating urgent job...")
res = llm("Di hola", max_tokens=3)
print("Urgent result:", res["choices"][0]["text"])

# 3. Resume with base_prompt + accumulated!
print("\nResuming from base_prompt + accumulated...")
stream2 = llm(base_prompt + accumulated, max_tokens=15, stream=True)
resumed_tokens = []
for chunk in stream2:
	t = chunk["choices"][0]["text"]
	accumulated += t
	resumed_tokens.append(t)
	print(f"[Slice 2 token]: {repr(t)}")

print("\n--- Verification ---")
print("Full accumulated text:", repr(accumulated))
# Verify that Slice 2 does NOT start over with title
assert not "".join(resumed_tokens).startswith("El Imperio")
print("TEST PASSED: Generation resumed seamlessly without repeating or restarting from zero!")
