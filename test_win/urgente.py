import json
import os
import sys
import time
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
			"content": "Di hola en una frase (solo responde Hola)"
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

	is_stream = messages.get("stream", False)

	with open_stream() as response:
		if is_stream:
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
		else:
			raw_body = response.read().decode("utf-8")
			t_first = time.time()
			parsed = json.loads(raw_body)
			server_usage = parsed.get("usage")
			choices = parsed.get("choices")
			if choices and len(choices) > 0:
				content = choices[0].get("message", {}).get("content") or choices[0].get("text") or ""
				print(content, flush=True)
			tokens = server_usage.get("completion_tokens", 0) if server_usage else 0

	t_end = time.time()
	print("\n" + "=" * 60)
	if is_stream:
		gen_time = (t_end - t_first) if t_first else (t_end - t_start)
		ttft = (t_first - t_start) if t_first else 0.0
	else:
		gen_time = t_end - t_start
		ttft = gen_time

	tps_client = tokens / max(gen_time, 0.001)

	print("[METRICAS URGENTE - CLIENTE]:")
	print(f"  Tokens generados:       {tokens}")
	if is_stream:
		print(f"  Tiempo al primer token: {ttft:.3f} s")
	print(f"  Tiempo total respuesta: {gen_time:.3f} s")
	print(f"  Velocidad generacion:   {tps_client:.2f} tokens/s")

	if server_usage:
		print("[METRICAS URGENTE - SERVIDOR]:")
		print(f"  Prompt tokens:          {server_usage.get('prompt_tokens', 0)}")
		print(f"  Completion tokens:      {server_usage.get('completion_tokens', 0)}")
		print(f"  Prompt speed:           {server_usage.get('prompt_token_s', 0)} tokens/s")
		print(f"  Generation speed:       {server_usage.get('generate_token_s', 0)} tokens/s")
	print("=" * 60)


if __name__ == "__main__":
	main()