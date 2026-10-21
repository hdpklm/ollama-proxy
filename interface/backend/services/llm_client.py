import json
import os
import httpx
from typing import AsyncGenerator
from config import settings

DEFAULT_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "600.0"))

class LLMClient:
	def __init__(self, base_url: str = settings.LLM_URL):
		self.base_url = base_url.rstrip("/")

	def _get_headers(self) -> dict:
		headers = {"Content-Type": "application/json"}
		if settings.API_KEY:
			headers["Authorization"] = f"Bearer {settings.API_KEY}"
		return headers

	async def stream_chat(
		self,
		messages: list[dict],
		model: str = settings.LLM_MODEL,
		tools: list[dict] | None = None,
		priority: bool = False,
		fast: bool = True,
		max_tokens: int | None = None,
		temperature: float | None = None,
		**kwargs
	) -> AsyncGenerator[str | dict, None]:
		url = f"{self.base_url}/v1/chat/completions"
		payload = {
			"model": model,
			"messages": messages,
			"stream": True,
			"fast": fast,
			"priority": priority
		}
		if max_tokens is not None:
			payload["max_tokens"] = max_tokens
		if temperature is not None:
			payload["temperature"] = temperature
		if tools:
			payload["tools"] = tools
			payload["tool_choice"] = kwargs.get("tool_choice", "auto")
		payload.update(kwargs)
		headers = self._get_headers()

		async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
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
							tool_calls = delta.get("tool_calls")
							if tool_calls:
								yield {"tool_calls": tool_calls}
							reasoning = delta.get("reasoning_content") or delta.get("thinking")
							if reasoning:
								yield {"reasoning_content": reasoning}
							content = delta.get("content", "")
							if content:
								yield content
						elif "usage" in data:
							yield {
								"type": "usage",
								"usage": data.get("usage"),
								"priority": data.get("priority"),
								"times_paused": data.get("times_paused"),
								"kv_cache_ram_mb": data.get("kv_cache_ram_mb")
							}
						elif "message" in data:
							msg = data.get("message", {})
							tool_calls = msg.get("tool_calls")
							if tool_calls:
								yield {"tool_calls": tool_calls}
							content = msg.get("content", "")
							if content:
								yield content
					except Exception:
						continue

	async def chat(
		self,
		messages: list[dict],
		model: str = settings.LLM_MODEL,
		tools: list[dict] | None = None,
		priority: bool = False,
		fast: bool = True,
		max_tokens: int | None = None,
		temperature: float | None = None,
		**kwargs
	) -> dict:
		url = f"{self.base_url}/v1/chat/completions"
		payload = {
			"model": model,
			"messages": messages,
			"stream": False,
			"fast": fast,
			"priority": priority
		}
		if max_tokens is not None:
			payload["max_tokens"] = max_tokens
		if temperature is not None:
			payload["temperature"] = temperature
		if tools:
			payload["tools"] = tools
			payload["tool_choice"] = kwargs.get("tool_choice", "auto")
		payload.update(kwargs)
		headers = self._get_headers()

		async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
			resp = await client.post(url, json=payload, headers=headers)
			if resp.status_code == 404:
				fallback_url = f"{self.base_url}/api/chat"
				resp = await client.post(fallback_url, json=payload, headers=headers)

			if resp.status_code >= 400:
				raise RuntimeError(f"LLM proxy {resp.status_code}: {resp.text}")
			data = resp.json()

			# Preserve all metadata (priority, times_paused, kv_cache_ram_mb, usage) while normalizing message
			if "choices" in data and data["choices"]:
				data["message"] = data["choices"][0].get("message", {})
				return data
			elif "message" in data:
				return data
			elif "response" in data:
				data["message"] = {"role": "assistant", "content": data["response"]}
				return data
			return data

	async def save_context_snapshot(self, snapshot_id: str = "caller_agent", priority: bool = False) -> bool:
		url = f"{self.base_url}/v1/context/snapshot/save"
		payload = {"snapshot_id": snapshot_id, "priority": priority}
		headers = self._get_headers()
		try:
			async with httpx.AsyncClient(timeout=10.0) as client:
				resp = await client.post(url, json=payload, headers=headers)
				return resp.status_code == 200 and resp.json().get("status") == "ok"
		except Exception as e:
			print(f"[LLMClient] Warning: Failed to save context snapshot '{snapshot_id}': {e}")
			return False

	async def restore_context_snapshot(self, snapshot_id: str = "caller_agent", priority: bool = False) -> bool:
		url = f"{self.base_url}/v1/context/snapshot/restore"
		payload = {"snapshot_id": snapshot_id, "priority": priority}
		headers = self._get_headers()
		try:
			async with httpx.AsyncClient(timeout=10.0) as client:
				resp = await client.post(url, json=payload, headers=headers)
				return resp.status_code == 200 and resp.json().get("status") == "ok"
		except Exception as e:
			print(f"[LLMClient] Warning: Failed to restore context snapshot '{snapshot_id}': {e}")
			return False
