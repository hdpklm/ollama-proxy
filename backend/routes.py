import os
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from backend.auth import require_key
from backend.config import OLLAMA_URL
from backend.job import CHAT, COMPLETION, GENERATE, Job
from backend.responses import EngineError, collect_body, stream_body

router = APIRouter(prefix="/v1", dependencies=[Depends(require_key)])
api_router = APIRouter()

REQUIRED_FIELD = {CHAT: "messages", COMPLETION: "prompt"}


def _build_job(kind, body):
	field = REQUIRED_FIELD[kind]
	if "model" not in body or field not in body:
		raise HTTPException(status_code=400, detail=f"'model' and '{field}' are required")
	if kind == COMPLETION and not isinstance(body["prompt"], str):
		raise HTTPException(status_code=400, detail="'prompt' must be a string")

	priority = bool(body.pop("priority", False))
	stream = bool(body.pop("stream", False))
	body.pop("stream_options", None)
	return Job(kind=kind, body=body, priority=priority, stream=stream)


async def _guarded_stream(job, scheduler):
	try:
		async for part in stream_body(job):
			yield part
	finally:
		scheduler.cancel(job)


async def _handle(request, kind):
	job = _build_job(kind, await request.json())
	scheduler = request.app.state.scheduler
	scheduler.submit(job)

	if job.stream:
		return StreamingResponse(_guarded_stream(job, scheduler), media_type="text/event-stream")

	try:
		return JSONResponse(await collect_body(job))
	except EngineError as error:
		raise HTTPException(status_code=502, detail=str(error))
	finally:
		scheduler.cancel(job)


@router.post("/chat/completions")
async def chat_completions(request: Request):
	return await _handle(request, CHAT)


@router.post("/completions")
async def completions(request: Request):
	return await _handle(request, COMPLETION)


@router.get("/models")
async def list_models(request: Request):
	engine = getattr(request.app.state, "engine", None)
	model_name = os.path.basename(engine.model_path) if engine else "default"
	return {
		"object": "list",
		"data": [
			{
				"id": model_name,
				"object": "model",
				"created": int(time.time()),
				"owned_by": "llama-cpp-python",
			}
		],
	}


@router.post("/embeddings")
async def passthrough_embeddings(request: Request):
	client = getattr(request.app.state, "client", None)
	if not client:
		raise HTTPException(status_code=501, detail="Embeddings not supported")
	upstream = await client.request(
		request.method,
		OLLAMA_URL + request.url.path,
		content=await request.body(),
		headers={"content-type": "application/json"},
	)
	return Response(upstream.content, status_code=upstream.status_code, media_type="application/json")


@api_router.post("/api/generate")
async def api_generate(request: Request):
	body = await request.json()
	prompt = str(body.get("prompt", ""))
	priority = bool(body.get("priority", False))
	stream = bool(body.get("stream", False))
	max_tokens = int(body.get("max_tokens", 100))

	job = Job(
		kind=GENERATE,
		body={"prompt": prompt, "max_tokens": max_tokens},
		priority=priority,
		stream=stream,
	)
	scheduler = request.app.state.scheduler
	scheduler.submit(job)

	if job.stream:
		return StreamingResponse(_guarded_stream(job, scheduler), media_type="text/event-stream")

	try:
		return JSONResponse(await collect_body(job))
	except EngineError as error:
		raise HTTPException(status_code=500, detail=str(error))
	finally:
		scheduler.cancel(job)
