import os
import subprocess

def resolve_model_path(model_name=None):
	env_path = os.getenv("MODEL_PATH", "").strip()
	if env_path and os.path.exists(env_path):
		return env_path

	if model_name:
		local_candidate = os.path.join(".", "modelos", model_name)
		if os.path.exists(local_candidate):
			return local_candidate
		if os.path.exists(local_candidate + ".gguf"):
			return local_candidate + ".gguf"

		try:
			res = subprocess.run(["ollama", "show", model_name, "--modelfile"], capture_output=True, encoding="utf-8", errors="replace")
			if res.returncode == 0:
				for line in res.stdout.splitlines():
					line = line.strip()
					if line.startswith("FROM ") and not line.startswith("FROM " + model_name):
						candidate = line[5:].strip()
						if os.path.exists(candidate):
							return candidate
		except Exception:
			pass

	return env_path or "./modelos/llama-3-8b-instruct-Q4_K_M.gguf"

print("Resolving gemma4:e2b:", resolve_model_path("gemma4:e2b"))
print("Resolving llama3.2:1b:", resolve_model_path("llama3.2:1b"))
