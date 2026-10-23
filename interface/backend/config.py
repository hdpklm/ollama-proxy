import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
	PORT: int = int(os.getenv("PORT", "8080"))
	HOST: str = os.getenv("HOST", "0.0.0.0")
	LLM_URL: str = os.getenv("LLM_URL", "http://ollama-proxy:8000")
	TTS_URL: str = os.getenv("TTS_URL", "http://piper-tts:5000")
	STT_URL: str = os.getenv("STT_URL", "http://vosk-stt:2700")
	LLM_MODEL: str = os.getenv("LLM_MODEL", "gemma4:e2b")
	TTS_VOICE: str = os.getenv("TTS_VOICE", "es_ES-sharvard-medium")
	SILENCE_TIMEOUT_MS: int = int(os.getenv("SILENCE_TIMEOUT_MS", "700"))
	API_KEY: str = os.getenv("API_KEY") or os.getenv("PROXY_API_KEY") or os.getenv("LLM_API_KEY") or "cambia_esta_clave"

	WEB_TOOLS_URL: str = os.getenv("WEB_TOOLS_URL", "http://web-tools:7000")
	REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
	PARALLEL_API_KEY: str = os.getenv("PARALLEL_API_KEY", "")
	PROMPTS_DIR: str = os.getenv("PROMPTS_DIR", "")
	SYSTEM_PROMPT_PATH: str = os.getenv("SYSTEM_PROMPT_PATH", "")
	HIDE_BACKGROUND: bool = os.getenv("HIDE_BACKGROUND", "false").strip().lower() in ("true", "1", "yes")

	class Config:
		env_file = ".env"
		extra = "ignore"

settings = Settings()

def get_prompts_dir() -> str:
	if settings.PROMPTS_DIR and os.path.isdir(settings.PROMPTS_DIR):
		return settings.PROMPTS_DIR
	candidates = [
		os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "prompts")),
		"/app/prompts",
		"./prompts",
		os.path.abspath(os.path.join(os.path.dirname(__file__), "prompts"))
	]
	for c in candidates:
		if os.path.isdir(c):
			return c
	return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "prompts"))

def load_prompt(name: str, fallback: str = "") -> str:
	try:
		from services.agent_manager import load_agent_profile
		profile = load_agent_profile(name)
		effective = profile.get_effective_prompt()
		if effective:
			return effective
	except Exception:
		pass

	prompts_dir = get_prompts_dir()
	file_candidates = [
		os.path.join(prompts_dir, f"{name}.md"),
		os.path.join(prompts_dir, f"{name}.txt"),
		os.path.join(prompts_dir, name),
	]
	if name in ("main", "system", "system_prompt"):
		if settings.SYSTEM_PROMPT_PATH and os.path.exists(settings.SYSTEM_PROMPT_PATH):
			file_candidates.insert(0, settings.SYSTEM_PROMPT_PATH)
		file_candidates.append(os.path.join(os.path.dirname(__file__), "system_prompt.md"))

	for path in file_candidates:
		if os.path.exists(path) and os.path.isfile(path):
			try:
				with open(path, "r", encoding="utf-8") as f:
					content = f.read().strip()
					if content:
						return content
			except Exception:
				pass
	return fallback

def load_default_system_prompt() -> str:
	default_fallback = (
		"Eres un asistente conversacional inteligente, conciso y directo en español.\n"
		"La marca de tiempo al inicio de los mensajes indica la fecha y hora local actual del usuario (Europe/Madrid). A partir de ella calcula directamente días como hoy, mañana o ayer sin pedir confirmación de fechas.\n"
		"Dispones de herramientas nativas (como `search_web`) para consultar datos en tiempo real (meteorología, noticias o datos recientes). Úsalas directamente cuando te consulten sobre el tiempo o información actualizada.\n"
		"Dispones también de sub-agentes especializados (`delegate_to_researcher`, `delegate_to_coder`, `delegate_to_writer`) para delegar tareas complejas de análisis técnico/investigación, programación/arquitectura o redacción ejecutiva.\n"
		"NUNCA repitas marcas de tiempo ni encabezados entre corchetes en tus respuestas. Responde con naturalidad, precisión y brevedad."
	)
	return load_prompt("system_prompt", fallback=default_fallback)

def ensure_system_prompt(messages: list[dict]) -> list[dict]:
	if not any(m.get("role") == "system" for m in messages):
		prompt_text = load_default_system_prompt()
		return [{"role": "system", "content": prompt_text}, *messages]
	return messages
