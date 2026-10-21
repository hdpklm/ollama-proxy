import json
import urllib.request
import urllib.error

url = "http://127.0.0.1:8000/v1/chat/completions"
messages = [
	{"role": "system", "content": "Eres un asistente meteorológico."},
	{"role": "user", "content": "qué tiempo hace mañana en Barcelona"},
	{"role": "assistant", "content": "<|tool_call>call:search_web{query:<|\"|>tiempo mañana en Barcelona<|\"|>}<tool_call|>"},
	{"role": "user", "content": "[Resultado de herramienta search_web]:\nSoleado con máximas de 22C y mínimas de 16C."}
]

payload = {
	"model": "gemma4:e2b",
	"messages": messages,
	"stream": False,
	"fast": True,
	"priority": False,
	"max_tokens": 64
}

data = json.dumps(payload).encode("utf-8")
headers = {
	"Content-Type": "application/json",
	"Authorization": "Bearer cambia_esta_clave"
}

req = urllib.request.Request(url, data=data, headers=headers)
print("Enviando petición Turn 2 a ollama-proxy...")

try:
	with urllib.request.urlopen(req, timeout=300) as resp:
		print("Status:", resp.status)
		print("Body:", resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
	print("HTTPError code:", e.code, e.reason)
	print("HTTPError body:", e.read().decode("utf-8"))
except Exception as e:
	print("Error:", e)
