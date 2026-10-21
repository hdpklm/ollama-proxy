import json
import time
import urllib.request

url = "http://127.0.0.1:8000/v1/chat/completions"
payload = {
	"model": "gemma4:e2b",
	"messages": [
		{"role": "user", "content": "di 'hola'"}
	],
	"stream": True,
	"max_tokens": 10,
	"fast": True,
	"priority": False
}

data = json.dumps(payload).encode("utf-8")
headers = {
	"Content-Type": "application/json",
	"Authorization": "Bearer cambia_esta_clave"
}

req = urllib.request.Request(url, data=data, headers=headers)
print("Enviando petición streaming a ollama-proxy...")

t0 = time.time()
try:
	with urllib.request.urlopen(req, timeout=120) as resp:
		print(f"Conectado en {time.time() - t0:.2f}s, leyendo stream:")
		for line in resp:
			line_str = line.decode("utf-8").strip()
			if line_str.startswith("data: "):
				data_part = line_str[6:]
				if data_part == "[DONE]":
					print("\n[STREAM DONE]")
					break
				try:
					parsed = json.loads(data_part)
					choices = parsed.get("choices", [])
					if choices:
						delta = choices[0].get("delta", {})
						content = delta.get("content", "")
						if content:
							print(content, end="", flush=True)
				except Exception:
					print(data_part)
	print(f"\nTotal tiempo: {time.time() - t0:.2f}s")
except Exception as e:
	print("\nError:", e)
