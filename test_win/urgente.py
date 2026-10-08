import json
import os
import sys
import urllib.request

URL = os.getenv("URL", "http://127.0.0.1:8000")
KEY = os.getenv("KEY", "cambia_esta_clave")

messages = {
	"model": "gemma4:e2b",
	"stream": True,
	"priority": True,
	"max_tokens": 500,
	"messages": [
		{
			"role": "user",
			"content": "Di hola en una frase"
		}
	]
} 

def load_payload(path):
	with open(path, encoding="utf-8") as file:
		return file.read().encode("utf-8")


def open_stream():
	request = urllib.request.Request(
		f"{URL}/v1/chat/completions",
		data=json.dumps(messages).encode("utf-8"),
		headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
	)
	return urllib.request.urlopen(request)


def iter_text(response):
	for raw in response:
		line = raw.decode("utf-8").strip()
		if not line.startswith("data:"):
			continue
		data = line[5:].strip()
		if data == "[DONE]":
			return
		choices = json.loads(data).get("choices")
		if choices:
			yield choices[0].get("delta", {}).get("content") or ""


def main():
	sys.stdout.reconfigure(encoding="utf-8")
	with open_stream() as response:
		for text in iter_text(response):
			print(text, end="", flush=True)
	print()

if __name__ == "__main__":
	main()