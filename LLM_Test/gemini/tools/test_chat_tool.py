import json
import time
import urllib.request
import urllib.error

url = "http://127.0.0.1:8080/api/chat"
payload = {
	"messages": [
		{"role": "user", "content": "qué tiempo hace mañana en Barcelona"}
	],
	"fast": True,
	"priority": False,
	"max_tokens": 128
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Enviando petición a interface /api/chat con timeout=600s...")
t0 = time.time()
try:
	with urllib.request.urlopen(req, timeout=600) as response:
		res_body = response.read().decode("utf-8")
		res_json = json.loads(res_body)
		print(f"\nRespuesta recibida en {time.time() - t0:.2f}s:")
		print(json.dumps(res_json, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
	print(f"HTTP Error {e.code}: {e.reason} en {time.time() - t0:.2f}s")
	print(f"Detalle: {e.read().decode('utf-8')}")
except Exception as e:
	print(f"Error al enviar la petición en {time.time() - t0:.2f}s: {e}")
