import sys
import os
import json
import pickle

from backend.prompt_cache import DEFAULT_AGENT_PROMPTS, DEFAULT_AGENT_METADATA, build_tools_for_agent_metadata

with open("./cache/prompt_states/main_agent_87f9530d0821a813.bin", "rb") as f:
	cache_data = pickle.load(f)

cached_tokens = cache_data.get("tokens", [])
print(f"Cached tokens len: {len(cached_tokens)}")

# Tokenize request messages
from main import app
engine = app.state.engine
llm = engine.llm_low
pc = engine.prompt_cache

base_sys = DEFAULT_AGENT_PROMPTS["main_agent"]
meta = DEFAULT_AGENT_METADATA.get("main_agent", {})
tools = build_tools_for_agent_metadata(meta)

messages = [
	{"role": "system", "content": base_sys},
	{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:00]\nHola"}
]

request_tokens = pc.tokenize_messages(llm, messages, tools=tools)
print(f"Request tokens len: {len(request_tokens)}")

matched_so_far = 0
for i in range(min(len(cached_tokens), len(request_tokens))):
	if cached_tokens[i] == request_tokens[i]:
		matched_so_far += 1
	else:
		print(f"MISMATCH at index {i}!")
		print(f"  Cached token[{i}]:  {cached_tokens[i]} -> {repr(llm.detokenize([cached_tokens[i]]).decode('utf-8', errors='replace'))}")
		print(f"  Request token[{i}]: {request_tokens[i]} -> {repr(llm.detokenize([request_tokens[i]]).decode('utf-8', errors='replace'))}")
		print(f"  Cached next 5:  {cached_tokens[i:i+5]}")
		print(f"  Request next 5: {request_tokens[i:i+5]}")
		break

print(f"Total tokens matching prefix from start: {matched_so_far}")
if matched_so_far == len(cached_tokens):
	print("SUCCESS: 100% of cached tokens match prefix!")
else:
	print(f"FAILURE: Only {matched_so_far}/{len(cached_tokens)} tokens matched.")
