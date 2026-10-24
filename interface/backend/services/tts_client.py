import httpx
from config import settings

class TTSClient:
	def __init__(self, base_url: str = settings.TTS_URL):
		self.base_url = base_url.rstrip("/")

	async def synthesize(self, text: str, voice: str = settings.TTS_VOICE) -> bytes:
		if not text.strip():
			return b""

		url = f"{self.base_url}/"
		try:
			async with httpx.AsyncClient(timeout=5.0) as client:
				try:
					resp = await client.post(
						url,
						content=text.encode("utf-8"),
						headers={"Content-Type": "text/plain; charset=utf-8"},
						params={"voice": voice} if voice else {}
					)
					if resp.status_code == 200:
						return resp.content
				except Exception:
					pass

				try:
					resp = await client.get(
						f"{self.base_url}/api/tts",
						params={"text": text, "voice": voice}
					)
					if resp.status_code == 200:
						return resp.content
				except Exception:
					pass
		except Exception as e:
			print(f"[TTSClient] Warning: Could not synthesize audio: {e}")
		return b""
