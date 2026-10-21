from fastapi import APIRouter, UploadFile, File, Response, HTTPException
from pydantic import BaseModel
from services.llm_client import LLMClient
from services.tts_client import TTSClient
from services.stt_client import STTClient

router = APIRouter(prefix="/api", tags=["chat"])

llm_service = LLMClient()
tts_service = TTSClient()
stt_service = STTClient()

from routes.call_ws import stamp
from services.tool_executor import execute_tool
from services.adapters import get_adapter
from config import ensure_system_prompt, settings

class ChatRequest(BaseModel):
	messages: list[dict]
	model: str | None = None
	priority: bool | None = False
	fast: bool | None = True
	max_tokens: int | None = None
	temperature: float | None = None

class TTSRequest(BaseModel):
	text: str
	voice: str | None = None

from services.tool_definitions import NATIVE_TOOLS
import json

@router.post("/chat")
async def handle_chat(req: ChatRequest):
	try:
		messages = []
		for m in req.messages:
			if m.get("role") == "user":
				user_text = m.get("content", "")
				if not user_text.startswith(("[Fecha y hora", "[Hora local")):
					messages.append({"role": "user", "content": stamp(user_text)})
				else:
					messages.append(m)
			else:
				messages.append(m)
		messages = ensure_system_prompt(messages)

		# Native OpenAI Tool Calling Loop (up to 3 steps)
		selected_model = req.model or settings.LLM_MODEL or "gemma4:e2b"
		executed_tools = []
		debug_events = []
		for step in range(3):
			if not settings.HIDE_BACKGROUND:
				debug_events.append({"stage": "turn_start", "step": step, "model": selected_model, "tools_enabled": step == 0})
			res = await llm_service.chat(
				messages,
				model=selected_model,
				tools=NATIVE_TOOLS if step == 0 else None,
				priority=bool(req.priority),
				fast=bool(req.fast if req.fast is not None else True),
				max_tokens=req.max_tokens,
				temperature=req.temperature,
			)
			adapter = get_adapter(selected_model)
			msg = res.get("message", {})
			tool_calls = adapter.extract_tool_calls(
				native_tool_calls=msg.get("tool_calls"),
				text_content=msg.get("content")
			)

			if tool_calls:
				if msg.get("tool_calls"):
					messages.append(msg)
				for tc in tool_calls:
					print(f"[REST Chat] Tool call detected ({adapter.name}): {tc.name} args={tc.args}")
					if not settings.HIDE_BACKGROUND:
						debug_events.append({"stage": "tool_calling", "tool": tc.name, "args": tc.args, "step": step})
					tool_result = await execute_tool(tc.name, tc.args)
					executed_tools.append({"tool": tc.name, "args": tc.args})
					if not settings.HIDE_BACKGROUND:
						debug_events.append({"stage": "tool_result", "tool": tc.name, "result": tool_result})
					messages.extend(adapter.format_tool_response(tc, tool_result))
				continue

			res["tools_used"] = executed_tools
			if not settings.HIDE_BACKGROUND:
				res["debug_events"] = debug_events
			return res

		res["tools_used"] = executed_tools
		if not settings.HIDE_BACKGROUND:
			res["debug_events"] = debug_events
		return res
	except Exception as e:
		import traceback
		traceback.print_exc()
		raise HTTPException(status_code=502, detail=f"LLM proxy error: {repr(e)}")

@router.post("/stt")
async def handle_stt(file: UploadFile = File(...)):
	try:
		audio_bytes = await file.read()
		text = await stt_service.transcribe_audio(audio_bytes)
		return {"text": text}
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"STT error: {str(e)}")

@router.post("/tts")
async def handle_tts(req: TTSRequest):
	try:
		wav_bytes = await tts_service.synthesize(req.text, voice=req.voice or "")
		return Response(content=wav_bytes, media_type="audio/wav")
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"TTS error: {str(e)}")
