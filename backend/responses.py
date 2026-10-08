import json
import time

from backend.job import CHAT, DELTA, DONE, GENERATE, Job


class EngineError(Exception):
	pass


UpstreamError = EngineError


def _sse(payload):
	return f"data: {json.dumps(payload)}\n\n"


def _chunk(job, text="", finish=None, role=False):
	if job.kind == GENERATE:
		return {
			"response": text,
			"done": finish is not None,
			"priority": job.priority,
			"kv_cache_ram_mb": job.kv_cache_ram_mb,
		}

	if job.kind == CHAT:
		delta = {"content": text} if (text or role) else {}
		if role:
			delta["role"] = "assistant"
		choice = {"index": 0, "delta": delta, "finish_reason": finish}
		kind = "chat.completion.chunk"
	else:
		choice = {"index": 0, "text": text, "finish_reason": finish}
		kind = "text_completion"

	prefix = "chatcmpl" if job.kind == CHAT else "cmpl"
	return {
		"id": f"{prefix}-{job.id}",
		"object": kind,
		"created": job.created,
		"model": job.body.get("model", "local"),
		"choices": [choice],
	}


async def stream_body(job):
	prefix = "chatcmpl" if job.kind == CHAT else "cmpl"
	if job.kind == CHAT:
		yield _sse(_chunk(job, role=True))

	while True:
		event, value = await job.out.get()
		if event == DELTA:
			yield _sse(_chunk(job, value))
			continue
		if event == DONE:
			yield _sse(_chunk(job, finish=value))
			yield _sse({
				"id": f"{prefix}-{job.id}",
				"object": "chat.completion.chunk" if job.kind == CHAT else "text_completion",
				"created": job.created,
				"model": job.body.get("model", "local"),
				"choices": [],
				"usage": {
					"prompt_tokens": job.prompt_tokens,
					"completion_tokens": job.generated,
					"total_tokens": job.prompt_tokens + job.generated,
					"prompt_token_s": job.prompt_tps,
					"generate_token_s": job.generation_tps,
					"prompt_tokens_per_second": job.prompt_tps,
					"tokens_per_second": job.generation_tps,
				},
				"priority": job.priority,
			})
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
			raise EngineError(value)

	if job.kind == GENERATE:
		result = {
			"response": job.partial,
			"priority": job.priority,
			"prompt_tokens": job.prompt_tokens,
			"completion_tokens": job.generated,
			"prompt_token_s": job.prompt_tps,
			"generate_token_s": job.generation_tps,
			"prompt_tokens_per_second": job.prompt_tps,
			"tokens_per_second": job.generation_tps,
			"kv_cache_ram_mb": job.kv_cache_ram_mb,
			"time_seconds": round(time.time() - job.created, 2),
		}
		if not job.priority:
			result["times_paused"] = job.times_paused
		return result

	prefix = "chatcmpl" if job.kind == CHAT else "cmpl"
	usage = {
		"prompt_tokens": job.prompt_tokens,
		"completion_tokens": job.generated,
		"total_tokens": job.prompt_tokens + job.generated,
		"prompt_token_s": job.prompt_tps,
		"generate_token_s": job.generation_tps,
		"prompt_tokens_per_second": job.prompt_tps,
		"tokens_per_second": job.generation_tps,
	}

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

	res = {
		"id": f"{prefix}-{job.id}",
		"object": kind,
		"created": job.created,
		"model": job.body.get("model", "local"),
		"choices": [choice],
		"usage": usage,
		"priority": job.priority,
	}
	if not job.priority and job.times_paused > 0:
		res["times_paused"] = job.times_paused
	return res
