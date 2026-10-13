import json
import httpx
from typing import AsyncGenerator
from config import settings

class LLMClient:
	def __init__(self, base_url: str = settings.LLM_URL):
		self.base_url = base_url.rstrip("/")

	def _get_headers(self) -> dict:
		headers = {"Content-Type": "application/json"}
		if settings.API_KEY:
			headers["Authorization"] = f"Bearer {settings.API_KEY}"
		return headers

	async def stream_chat(self, messages: list[dict], model: str = settings.LLM_MODEL) -> AsyncGenerator[str, None]:
		url = f"{self.base_url}/v1/chat/completions"
		payload = {
			"model": model,
			"messages": messages,
			"stream": True,
			"fast": True
		}
		headers = self._get_headers()

		async with httpx.AsyncClient(timeout=60.0) as client:
			async with client.stream("POST", url, json=payload, headers=headers) as response:
				if response.status_code == 404:
					fallback_url = f"{self.base_url}/api/chat"
					async with client.stream("POST", fallback_url, json=payload, headers=headers) as fb_resp:
						fb_resp.raise_for_status()
						async for line in fb_resp.aiter_lines():
							if not line:
								continue
							try:
								data = json.loads(line)
								content = data.get("message", {}).get("content", "")
								if content:
									yield content
							except Exception:
								continue
					return

				response.raise_for_status()
				async for line in response.aiter_lines():
					if not line:
						continue
					clean_line = line.strip()
					if clean_line.startswith("data: "):
						clean_line = clean_line[6:].strip()
					if clean_line == "[DONE]":
						break
					try:
						data = json.loads(clean_line)
						choices = data.get("choices", [])
						if choices:
							delta = choices[0].get("delta", {})
							content = delta.get("content", "")
							if content:
								yield content
						elif "message" in data:
							content = data.get("message", {}).get("content", "")
							if content:
								yield content
					except Exception:
						continue

	async def chat(self, messages: list[dict], model: str = settings.LLM_MODEL) -> dict:
		url = f"{self.base_url}/v1/chat/completions"
		payload = {
			"model": model,
			"messages": messages,
			"stream": False,
			"fast": True
		}
		headers = self._get_headers()

		async with httpx.AsyncClient(timeout=60.0) as client:
			resp = await client.post(url, json=payload, headers=headers)
			if resp.status_code == 404:
				fallback_url = f"{self.base_url}/api/chat"
				resp = await client.post(fallback_url, json=payload, headers=headers)

			resp.raise_for_status()
			data = resp.json()

			# Normalize response to standard format for frontend
			if "choices" in data and data["choices"]:
				msg = data["choices"][0].get("message", {})
				return {"message": msg}
			elif "message" in data:
				return {"message": data["message"]}
			elif "response" in data:
				return {"message": {"role": "assistant", "content": data["response"]}}
			return data
