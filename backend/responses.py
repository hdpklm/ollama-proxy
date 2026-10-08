import json

from backend.job import CHAT, DELTA, DONE
from backend.upstream import UpstreamError


def _sse(payload):
	return f"data: {json.dumps(payload)}\n\n"


def _chunk(job, text="", finish=None, role=False):
	if job.kind == CHAT:
		delta = {"content": text} if (text or role) else {}
		if role:
			delta["role"] = "assistant"
		choice = {"index": 0, "delta": delta, "finish_reason": finish}
		kind = "chat.completion.chunk"
	else:
		choice = {"index": 0, "text": text, "finish_reason": finish}
		kind = "text_completion"

	return {
		"id": f"cmpl-{job.id}",
		"object": kind,
		"created": job.created,
		"model": job.body.get("model"),
		"choices": [choice],
	}


async def stream_body(job):
	if job.kind == CHAT:
		yield _sse(_chunk(job, role=True))

	while True:
		event, value = await job.out.get()
		if event == DELTA:
			yield _sse(_chunk(job, value))
			continue
		if event == DONE:
			yield _sse(_chunk(job, finish=value))
		else:
			yield _sse({"error": {"message": value}})
		yield "data: [DONE]\n\n"
		return


async def collect_body(job):
	while True:
		event, value = await job.out.get()
		if event == DONE:
			break
		if event != DELTA:
			raise UpstreamError(value)

	usage = {"prompt_tokens": 0, "completion_tokens": job.generated, "total_tokens": job.generated}

	if job.kind == CHAT:
		choice = {
			"index": 0,
			"message": {"role": "assistant", "content": job.partial},
			"finish_reason": value,
		}
		kind = "chat.completion"
	else:
		choice = {"index": 0, "text": job.partial, "finish_reason": value}
		kind = "text_completion"

	return {
		"id": f"cmpl-{job.id}",
		"object": kind,
		"created": job.created,
		"model": job.body.get("model"),
		"choices": [choice],
		"usage": usage,
	}
