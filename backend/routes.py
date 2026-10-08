from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from backend.auth import require_key
from backend.config import OLLAMA_URL
from backend.job import CHAT, COMPLETION, Job
from backend.responses import collect_body, stream_body
from backend.upstream import UpstreamError

router = APIRouter(prefix="/v1", dependencies=[Depends(require_key)])

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
	except UpstreamError as error:
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
@router.post("/embeddings")
async def passthrough(request: Request):
	upstream = await request.app.state.client.request(
		request.method,
		OLLAMA_URL + request.url.path,
		content=await request.body(),
		headers={"content-type": "application/json"},
	)
	return Response(upstream.content, status_code=upstream.status_code, media_type="application/json")
