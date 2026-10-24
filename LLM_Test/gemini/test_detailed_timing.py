import sys
import os
sys.path.insert(0, os.path.abspath("."))

import json
import time
import urllib.request

def test_timing():
	url = "http://localhost:8000/v1/chat/completions"
	payload = {
		"model": "default",
		"messages": [
			{"role": "user", "content": "Di exactamente: Hola mundo."}
		],
		"stream": True,
		"max_tokens": 10
	}
	req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": "Bearer cambia_esta_clave"})

	t_start = time.time()
	t_first = None
	tokens = []

	with urllib.request.urlopen(req) as resp:
		t_connected = time.time() - t_start
		print(f"HTTP Connection established at: {t_connected:.3f}s")
		for raw_line in resp:
			line = raw_line.decode("utf-8").strip()
			if not line or not line.startswith("data: "):
				continue
			data_str = line[6:]
			if data_str == "[DONE]":
				break
			try:
				chunk = json.loads(data_str)
				content = chunk["choices"][0].get("delta", {}).get("content", "")
				if content:
					now = time.time()
					if t_first is None:
						t_first = now - t_start
						print(f"FIRST TOKEN ({t_first:.3f}s): {repr(content)}")
					else:
						print(f"TOKEN (+{now - tokens[-1][1]:.3f}s): {repr(content)}")
					tokens.append((content, now))
			except Exception:
				pass

	total_time = time.time() - t_start
	print(f"Total time: {total_time:.3f}s, total tokens: {len(tokens)}")

if __name__ == "__main__":
	test_timing()
