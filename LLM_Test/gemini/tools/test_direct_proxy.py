import json
import urllib.request
import urllib.error

url = "http://127.0.0.1:8000/v1/chat/completions"
payload = {
	"model": "gemma4:e2b",
	"messages": [
		{"role": "user", "content": "hola"}
	],
	"stream": False,
	"fast": True,
	"priority": False
}

data = json.dumps(payload).encode("utf-8")
headers = {
	"Content-Type": "application/json",
	"Authorization": "Bearer cambia_esta_clave"
}

req = urllib.request.Request(url, data=data, headers=headers)
print("Enviando petición directa a ollama-proxy /v1/chat/completions...")

try:
	with urllib.request.urlopen(req, timeout=120) as resp:
		print("Status:", resp.status)
		body = resp.read().decode("utf-8")
		print("Body:", body[:500])
except urllib.error.HTTPError as e:
	print("HTTPError code:", e.code, e.reason)
	print("HTTPError body:", e.read().decode("utf-8"))
except Exception as e:
	print("Error:", e)
