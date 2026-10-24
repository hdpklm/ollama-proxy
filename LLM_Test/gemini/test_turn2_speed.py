import sys
import os
import json
import time
import urllib.request
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("interface/backend"))

from config import load_default_system_prompt
from tools import get_tools_for_agent
from services.agent_manager import load_agent_profile

base_sys = load_default_system_prompt()
profile = load_agent_profile("system_prompt")
tools = get_tools_for_agent(profile)

payload_turn2 = {
	"model": "default",
	"messages": [
		{"role": "system", "content": base_sys},
		{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:00]\nHola"},
		{"role": "assistant", "content": "Hola, ¿en qué puedo ayudarte hoy?"},
		{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:10]\n¿Qué tiempo hace?"}
	],
	"tools": tools,
	"stream": False,
	"max_tokens": 5
}

t0 = time.time()
req = urllib.request.Request(
	"http://localhost:8000/v1/chat/completions",
	data=json.dumps(payload_turn2).encode("utf-8"),
	headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"}
)

with urllib.request.urlopen(req) as resp:
	res = json.loads(resp.read().decode("utf-8"))
	elapsed = time.time() - t0
	print(f"Turn 2 finished in {elapsed:.3f}s!")
	print("Response:", res)
