import json

from backend.config import OLLAMA_URL
from backend.job import CHAT


class UpstreamError(Exception):
	pass


def build_request(job):
	body = dict(job.body)
	body["stream"] = True

	limit = body.pop("max_completion_tokens", None) or body.get("max_tokens")
	if limit:
		body["max_tokens"] = max(1, limit - job.generated)

	if job.kind == CHAT:
		path = "/v1/chat/completions"
		if job.partial:
			body["messages"] = [*body["messages"], {"role": "assistant", "content": job.partial}]
	else:
		path = "/v1/completions"
		if job.partial:
			body["prompt"] = body["prompt"] + job.partial

	return path, body


def extract(job, chunk):
	choice = chunk["choices"][0]
	if job.kind == CHAT:
		text = (choice.get("delta") or {}).get("content") or ""
	else:
		text = choice.get("text") or ""
	return text, choice.get("finish_reason")


async def stream_events(client, job):
	path, body = build_request(job)
	async with client.stream("POST", OLLAMA_URL + path, json=body) as response:
		if response.status_code >= 400:
			raise UpstreamError((await response.aread()).decode())

		async for line in response.aiter_lines():
			if not line.startswith("data:"):
				continue
			payload = line[5:].strip()
			if payload == "[DONE]":
				return
			chunk = json.loads(payload)
			if chunk.get("choices"):
				yield extract(job, chunk)
