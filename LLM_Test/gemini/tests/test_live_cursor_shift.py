import sys
sys.path.insert(0, "interface/backend")
import urllib.request
import json
import time
from services.tool_definitions import NATIVE_TOOLS

def test_live_cursor():
	url = "http://localhost:8000/v1/chat/completions"
	headers = {
		"Content-Type": "application/json",
		"Authorization": "Bearer cambia_esta_clave"
	}

	with open("prompts/system_prompt.md", "r", encoding="utf-8") as f:
		sys_content = f.read().strip()

	# Caso de uso real: el system prompt oficial + tools
	# y primer turno de usuario ("hola")
	tools = NATIVE_TOOLS

	payload = {
		"model": "gemma4:e2b",
		"messages": [
			{"role": "system", "content": sys_content},
			{"role": "user", "content": "hola"}
		],
		"tools": tools,
		"max_tokens": 10,
		"stream": False
	}

	req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
	t0 = time.time()
	try:
		with urllib.request.urlopen(req, timeout=30) as resp:
			duration = time.time() - t0
			data = json.loads(resp.read().decode("utf-8"))
			content = data["choices"][0]["message"]["content"]
			print(f"Respuesta recibida en {duration:.2f}s:")
			print(f"Contenido: '{content.encode('ascii', 'ignore').decode()}'")
	except Exception as e:
		print(f"Error en peticion: {e}")

if __name__ == "__main__":
	test_live_cursor()
