import json
import httpx
from typing import AsyncGenerator
from config import settings

class LLMClient:
	def __init__(self, base_url: str = settings.LLM_URL):
		self.base_url = base_url.rstrip("/")

	async def stream_chat(self, messages: list[dict], model: str = settings.LLM_MODEL) -> AsyncGenerator[str, None]:
		url = f"{self.base_url}/api/chat"
		payload = {
			"model": model,
			"messages": messages,
			"stream": True
		}
		headers = {}
		if settings.API_KEY:
			headers["Authorization"] = f"Bearer {settings.API_KEY}"

		async with httpx.AsyncClient(timeout=60.0) as client:
			async with client.stream("POST", url, json=payload, headers=headers) as response:
				response.raise_for_status()
				async for line in response.aiter_lines():
					if not line:
						continue
					try:
						data = json.loads(line)
						msg = data.get("message", {})
						content = msg.get("content", "")
						if content:
							yield content
					except json.JSONDecodeError:
						continue

	async def chat(self, messages: list[dict], model: str = settings.LLM_MODEL) -> dict:
		url = f"{self.base_url}/api/chat"
		payload = {
			"model": model,
			"messages": messages,
			"stream": False
		}
		headers = {}
		if settings.API_KEY:
			headers["Authorization"] = f"Bearer {settings.API_KEY}"

		async with httpx.AsyncClient(timeout=60.0) as client:
			resp = await client.post(url, json=payload, headers=headers)
			resp.raise_for_status()
			return resp.json()
