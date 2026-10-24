import sys
import os
sys.path.insert(0, os.path.abspath("."))
import json
import time
import urllib.request

url = "http://localhost:8000/v1/chat/completions"

with open("prompts/system_prompt.md", "r", encoding="utf-8") as f:
	content = f.read()

from backend.prompt_cache import _parse_and_get_effective_prompt
effective_prompt, meta = _parse_and_get_effective_prompt(content)

with open("prompts/tools_registry.json", "r", encoding="utf-8") as f:
	tools_dict = json.load(f)

# Tools assigned to system_prompt
tools = [
	tools_dict["delegate_to_researcher"],
	tools_dict["delegate_to_coder"],
	tools_dict["delegate_to_writer"],
	tools_dict["search_web"],
]

payload = {
	"model": "default",
	"messages": [
		{"role": "system", "content": effective_prompt},
		{"role": "user", "content": "Hola, como te llamas?"}
	],
	"tools": tools,
	"stream": True,
	"max_tokens": 10
}

t0 = time.time()
req = urllib.request.Request(
	url,
	data=json.dumps(payload).encode("utf-8"),
	headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"}
)

first_token_time = None
with urllib.request.urlopen(req) as resp:
	for line in resp:
		line = line.decode("utf-8").strip()
		if line.startswith("data: ") and line[6:] != "[DONE]":
			if first_token_time is None:
				first_token_time = time.time() - t0
			print("Chunk:", line)

print(f"\nTurn 1 (First request with tools) TTFT: {first_token_time:.3f}s")

# Turn 2: Follow up message to test temporal cache reuse
payload_turn2 = {
	"model": "default",
	"messages": [
		{"role": "system", "content": effective_prompt},
		{"role": "user", "content": "Hola, como te llamas?"},
		{"role": "assistant", "content": "Soy tu asistente virtual."},
		{"role": "user", "content": "En que puedes ayudarme?"}
	],
	"tools": tools,
	"stream": True,
	"max_tokens": 10
}

t0 = time.time()
req2 = urllib.request.Request(
	url,
	data=json.dumps(payload_turn2).encode("utf-8"),
	headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"}
)

turn2_ttft = None
with urllib.request.urlopen(req2) as resp:
	for line in resp:
		line = line.decode("utf-8").strip()
		if line.startswith("data: ") and line[6:] != "[DONE]":
			if turn2_ttft is None:
				turn2_ttft = time.time() - t0

print(f"Turn 2 (Follow-up with temporal cache) TTFT: {turn2_ttft:.3f}s")

# Turn 3: Follow up message to test temporal cache in-place replacement
payload_turn3 = {
	"model": "default",
	"messages": [
		{"role": "system", "content": effective_prompt},
		{"role": "user", "content": "Hola, como te llamas?"},
		{"role": "assistant", "content": "Soy tu asistente virtual."},
		{"role": "user", "content": "En que puedes ayudarme?"},
		{"role": "assistant", "content": "Puedo buscar informacion y delegar tareas."},
		{"role": "user", "content": "Que tiempo hace hoy?"}
	],
	"tools": tools,
	"stream": True,
	"max_tokens": 10
}

t0 = time.time()
req3 = urllib.request.Request(
	url,
	data=json.dumps(payload_turn3).encode("utf-8"),
	headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"}
)

turn3_ttft = None
with urllib.request.urlopen(req3) as resp:
	for line in resp:
		line = line.decode("utf-8").strip()
		if line.startswith("data: ") and line[6:] != "[DONE]":
			if turn3_ttft is None:
				turn3_ttft = time.time() - t0

print(f"Turn 3 (In-place replaced cache) TTFT: {turn3_ttft:.3f}s")
