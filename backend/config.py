import os
import subprocess

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
PROXY_API_KEY = os.getenv("PROXY_API_KEY", "")
MODEL_PATH = os.getenv("MODEL_PATH", "").strip()
N_CTX = int(os.getenv("N_CTX", "4096"))
N_CTX_HIGH = int(os.getenv("N_CTX_HIGH", "2048"))
N_THREADS = int(os.getenv("N_THREADS", "4"))


def resolve_model_path(model_name: str | None = None) -> str:
	if MODEL_PATH and os.path.exists(MODEL_PATH):
		return MODEL_PATH

	candidates = [model_name] if model_name else ["gemma4:e2b", "llama3.2:1b"]

	for name in candidates:
		if not name:
			continue
		local_candidate = os.path.join(".", "modelos", name)
		if os.path.exists(local_candidate):
			return local_candidate
		if os.path.exists(local_candidate + ".gguf"):
			return local_candidate + ".gguf"

		try:
			res = subprocess.run(["ollama", "show", name, "--modelfile"], capture_output=True, encoding="utf-8", errors="replace")
			if res.returncode == 0:
				for line in res.stdout.splitlines():
					line = line.strip()
					if line.startswith("FROM ") and not line.startswith("FROM " + name):
						blob_path = line[5:].strip()
						if os.path.exists(blob_path):
							return blob_path
		except Exception:
			pass

	return MODEL_PATH or "./modelos/llama-3-8b-instruct-Q4_K_M.gguf"
