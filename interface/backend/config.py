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

	class Config:
		env_file = ".env"
		extra = "ignore"

settings = Settings()
