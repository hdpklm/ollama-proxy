import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import threading
import time
import urllib.request
import uvicorn
from main import app

URL = "http://127.0.0.1:8002"
KEY = "cambia_esta_clave"

def start_server():
	config = uvicorn.Config(app, host="127.0.0.1", port=8002, log_level="warning")
	server = uvicorn.Server(config)
	server.run()

def open_stream(payload):
	req = urllib.request.Request(
		f"{URL}/v1/chat/completions",
		data=json.dumps(payload).encode("utf-8"),
		headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
	)
	return urllib.request.urlopen(req)

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

def test_concurrent():
	t_srv = threading.Thread(target=start_server, daemon=True)
	t_srv.start()
	time.sleep(12)  # Give server time to load model and bind port

	normal_payload = {
		"model": "gemma4:e2b",
		"stream": True,
		"max_tokens": 30,
		"messages": [{"role": "user", "content": "Tell a story about the ancient Roman empire"}]
	}

	urgent_payload = {
		"model": "gemma4:e2b",
		"stream": True,
		"priority": True,
		"max_tokens": 6,
		"messages": [{"role": "user", "content": "Di hola"}]
	}

	urgent_done = threading.Event()
	normal_tokens = []
	urgent_tokens = []

	def run_urgent():
		time.sleep(2.0) # Wait until normal has generated a few tokens
		print("\n[TEST CLIENT] >>> Launching URGENT request! <<<")
		with open_stream(urgent_payload) as resp:
			for text in iter_text(resp):
				if text:
					urgent_tokens.append(text)
					print(f"[URGENT CLIENT TOKEN]: {repr(text)}")
		print("[TEST CLIENT] >>> URGENT request completed! <<<\n")
		urgent_done.set()

	t_urgent = threading.Thread(target=run_urgent)

	print("[TEST CLIENT] Starting NORMAL request...")
	t_urgent.start()

	with open_stream(normal_payload) as resp:
		for text in iter_text(resp):
			if text:
				normal_tokens.append(text)
				print(f"[NORMAL CLIENT TOKEN]: {repr(text)}")

	t_urgent.join()
	print("\n--- Summary ---")
	print(f"Normal total tokens received: {len(normal_tokens)}")
	print(f"Urgent total tokens received: {len(urgent_tokens)}")
	print(f"Normal full text: {''.join(normal_tokens)}")
	print(f"Urgent full text: {''.join(urgent_tokens)}")
	print("Test finished successfully!")

if __name__ == "__main__":
	test_concurrent()
