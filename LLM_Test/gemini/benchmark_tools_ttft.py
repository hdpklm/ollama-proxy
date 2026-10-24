import sys
import os
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("interface/backend"))

import json
import time
import urllib.request
from tools import get_master_tool_schemas

def test():
	url = "http://localhost:8000/v1/chat/completions"

	with open("prompts/system_prompt.md", "r", encoding="utf-8") as f:
		from backend.prompt_cache import _parse_and_get_effective_prompt
		sys_content = _parse_and_get_effective_prompt(f.read())

	# Case A: System prompt + User message, NO tools
	payload_a = {
		"model": "default",
		"messages": [
			{"role": "system", "content": sys_content},
			{"role": "user", "content": "Di exactamente: Hola mundo."}
		],
		"stream": True,
		"max_tokens": 10
	}
	t0 = time.time()
	req_a = urllib.request.Request(url, data=json.dumps(payload_a).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"})
	with urllib.request.urlopen(req_a) as resp:
		first_a = None
		for line in resp:
			line = line.decode("utf-8").strip()
			if line.startswith("data: ") and line[6:] != "[DONE]":
				first_a = time.time() - t0
				break
	print(f"Case A (SysPrompt WITHOUT tools) TTFT: {first_a:.3f}s")

	# Case B: System prompt + User message, WITH tools
	tools = list(get_master_tool_schemas().values())
	payload_b = {
		"model": "default",
		"messages": [
			{"role": "system", "content": sys_content},
			{"role": "user", "content": "Di exactamente: Hola mundo."}
		],
		"tools": tools,
		"stream": True,
		"max_tokens": 10
	}
	t0 = time.time()
	req_b = urllib.request.Request(url, data=json.dumps(payload_b).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"})
	with urllib.request.urlopen(req_b) as resp:
		first_b = None
		for line in resp:
			line = line.decode("utf-8").strip()
			if line.startswith("data: ") and line[6:] != "[DONE]":
				first_b = time.time() - t0
				break
	print(f"Case B (SysPrompt WITH tools) TTFT: {first_b:.3f}s")

if __name__ == "__main__":
	test()
