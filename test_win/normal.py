import json
import os
import sys
import time
import urllib.request

URL = os.getenv("URL", "http://127.0.0.1:8000")
KEY = os.getenv("KEY", "cambia_esta_clave")

messages = {
	"model": "gemma4:e2b",
	"stream": False,
	"max_tokens": 500,
	"fast": True,
	"messages": [
		{
			"role": "user",
			"content": "Escribe un texto muy largo sobre la historia de Roma"
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


def main():
	sys.stdout.reconfigure(encoding="utf-8")
	t_start = time.time()
	t_first = None
	tokens = 0
	server_usage = None

	with open_stream() as response:
		for raw in response:
			line = raw.decode("utf-8").strip()
			if not line.startswith("data:"):
				continue
			data = line[5:].strip()
			if data == "[DONE]":
				break
			parsed = json.loads(data)
			if "usage" in parsed and parsed["usage"]:
				server_usage = parsed["usage"]
			choices = parsed.get("choices")
			if choices and len(choices) > 0:
				delta = choices[0].get("delta", {}).get("content") or ""
				if delta:
					if t_first is None:
						t_first = time.time()
					tokens += 1
					print(delta, end="", flush=True)

	t_end = time.time()
	print("\n" + "=" * 60)
	gen_time = (t_end - t_first) if t_first else (t_end - t_start)
	tps_client = tokens / max(gen_time, 0.001)
	ttft = (t_first - t_start) if t_first else 0.0

	print("[METRICAS CLIENTE]:")
	print(f"  Tokens generados:       {tokens}")
	print(f"  Tiempo al primer token: {ttft:.3f} s")
	print(f"  Tiempo de generacion:   {gen_time:.3f} s")
	print(f"  Velocidad generacion:   {tps_client:.2f} tokens/s")

	if server_usage:
		print("[METRICAS SERVIDOR]:")
		print(f"  Prompt tokens:          {server_usage.get('prompt_tokens', 0)}")
		print(f"  Completion tokens:      {server_usage.get('completion_tokens', 0)}")
		print(f"  Prompt speed:           {server_usage.get('prompt_token_s', 0)} tokens/s")
		print(f"  Generation speed:       {server_usage.get('generate_token_s', 0)} tokens/s")
	print("=" * 60)


if __name__ == "__main__":
	main()