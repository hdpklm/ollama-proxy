import json
import httpx
from config import settings

class STTClient:
	def __init__(self, base_url: str = settings.STT_URL):
		self.base_url = base_url.rstrip("/")

	async def transcribe_audio(self, audio_bytes: bytes) -> str:
		if not audio_bytes:
			return ""

		url = f"{self.base_url}/"
		async with httpx.AsyncClient(timeout=30.0) as client:
			try:
				resp = await client.post(
					url,
					content=audio_bytes,
					headers={"Content-Type": "audio/wav"}
				)
				if resp.status_code == 200:
					data = resp.json()
					return data.get("text", "")
			except Exception:
				pass

			resp = await client.post(
				f"{self.base_url}/asr",
				files={"file": ("audio.wav", audio_bytes, "audio/wav")}
			)
			if resp.status_code == 200:
				data = resp.json()
				return data.get("text", "")

		return ""
