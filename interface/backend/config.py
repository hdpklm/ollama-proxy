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
	SYSTEM_PROMPT_PATH: str = os.getenv("SYSTEM_PROMPT_PATH", os.path.join(os.path.dirname(__file__), "system_prompt.md"))

	class Config:
		env_file = ".env"
		extra = "ignore"

settings = Settings()

def load_default_system_prompt() -> str:
	path = settings.SYSTEM_PROMPT_PATH
	if os.path.exists(path):
		try:
			with open(path, "r", encoding="utf-8") as f:
				return f.read().strip()
		except Exception:
			pass
	return (
		"Eres un asistente conversacional inteligente, conciso y directo en español.\n"
		"La marca de tiempo [Hora local actual del usuario: ...] al inicio de los mensajes indica su fecha y hora local exacta (Europe/Madrid).\n\n"
		"## Herramientas Disponibles (Tool Calling)\n"
		"Si necesitas información externa, noticias actualizadas o consultar enlaces web/PDF, invoca una herramienta usando:\n"
		"<tool_call>\n"
		'{"name": "<nombre_herramienta>", "arguments": {<argumentos>}}\n'
		"</tool_call>\n\n"
		"Herramientas:\n"
		"- search_web(query: string): Busca información en internet.\n"
		"- read_url(url: string): Extrae y lee una página web en formato markdown.\n"
		"- read_pdf(url: string): Extrae y lee un documento PDF en una URL.\n\n"
		"Si no requieres herramientas, responde directamente con naturalidad y precisión."
	)

def ensure_system_prompt(messages: list[dict]) -> list[dict]:
	if not any(m.get("role") == "system" for m in messages):
		prompt_text = load_default_system_prompt()
		return [{"role": "system", "content": prompt_text}, *messages]
	return messages
