import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
	PORT: int = int(os.getenv("PORT", "8080"))
	HOST: str = os.getenv("HOST", "0.0.0.0")
	LLM_URL: str = os.getenv("LLM_URL", "http://ollama-proxy:8000")
	TTS_URL: str = os.getenv("TTS_URL", "http://piper-tts:5000")
	STT_URL: str = os.getenv("STT_URL", "http://vosk-stt:2700")
	LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen2.5:0.5b")
	TTS_VOICE: str = os.getenv("TTS_VOICE", "es_ES-davefx-medium")
	SILENCE_TIMEOUT_MS: int = int(os.getenv("SILENCE_TIMEOUT_MS", "700"))
	API_KEY: str = os.getenv("API_KEY", "")

	class Config:
		env_file = ".env"
		extra = "ignore"

settings = Settings()
