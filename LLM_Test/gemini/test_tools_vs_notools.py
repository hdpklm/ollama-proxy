import sys
import os
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("interface/backend"))

import json
import time
import urllib.request

def run_test():
	url = "http://localhost:8000/v1/chat/completions"
	with open("prompts/system_prompt.md", "r", encoding="utf-8") as f:
		from backend.prompt_cache import _parse_and_get_effective_prompt
		sys_content = _parse_and_get_effective_prompt(f.read())

	print(f"System prompt length: {len(sys_content)} chars")

	# Test 1: WITHOUT tools
	payload_no_tools = {
		"model": "default",
		"messages": [
			{"role": "system", "content": sys_content},
			{"role": "user", "content": "Hola, ¿cómo estás? Responde en 3 palabras."}
		],
		"stream": False,
		"max_tokens": 30
	}
	req = urllib.request.Request(url, data=json.dumps(payload_no_tools).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"})
	t0 = time.time()
	with urllib.request.urlopen(req) as resp:
		res = json.loads(resp.read().decode("utf-8"))
	t_no_tools = time.time() - t0
	print(f"WITHOUT tools response time: {t_no_tools:.3f}s, prompt_tokens: {res.get('usage', {}).get('prompt_tokens')}, content: {res.get('choices', [{}])[0].get('message', {}).get('content')}")

	# Test 2: WITH tools from tools definitions
	from interface.backend.tools import get_master_tool_schemas
	tools = list(get_master_tool_schemas().values())[:4]
	payload_with_tools = {
		"model": "default",
		"messages": [
			{"role": "system", "content": sys_content},
			{"role": "user", "content": "Hola, ¿cómo estás? Responde en 3 palabras."}
		],
		"tools": tools,
		"stream": False,
		"max_tokens": 30
	}
	req2 = urllib.request.Request(url, data=json.dumps(payload_with_tools).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"})
	t0 = time.time()
	with urllib.request.urlopen(req2) as resp:
		res2 = json.loads(resp.read().decode("utf-8"))
	t_with_tools = time.time() - t0
	print(f"WITH tools response time: {t_with_tools:.3f}s, prompt_tokens: {res2.get('usage', {}).get('prompt_tokens')}, content: {res2.get('choices', [{}])[0].get('message', {}).get('content')}")

if __name__ == "__main__":
	run_test()
