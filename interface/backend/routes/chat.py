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
from services.tool_executor import extract_tool_call, execute_tool
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
		for _ in range(3):
			res = await llm_service.chat(
				messages,
				model=selected_model,
				tools=NATIVE_TOOLS,
				priority=bool(req.priority),
				fast=bool(req.fast if req.fast is not None else True),
				max_tokens=req.max_tokens,
				temperature=req.temperature,
			)
			msg = res.get("message", {})
			tool_calls = msg.get("tool_calls", [])

			if tool_calls:
				messages.append(msg)
				for tc in tool_calls:
					fn = tc.get("function", {})
					fn_name = fn.get("name", "")
					raw_args = fn.get("arguments", {})
					if isinstance(raw_args, str):
						try:
							fn_args = json.loads(raw_args)
						except Exception:
							fn_args = {"query": raw_args}
					else:
						fn_args = raw_args
					print(f"[REST Chat] Native tool call detected: {fn_name} args={fn_args}")
					tool_result = await execute_tool(fn_name, fn_args)
					executed_tools.append({"tool": fn_name, "args": fn_args})
					messages.append({
						"role": "tool",
						"tool_call_id": tc.get("id", "call_1"),
						"name": fn_name,
						"content": tool_result
					})
				continue

			# Secondary fallback for text tool_call format
			content = msg.get("content", "") or ""
			tool_name, tool_args, tool_raw = extract_tool_call(content)
			if tool_name and tool_raw:
				print(f"[REST Chat] Text fallback tool call detected: {tool_name} args={tool_args}")
				tool_result = await execute_tool(tool_name, tool_args or {})
				executed_tools.append({"tool": tool_name, "args": tool_args})
				messages.append({"role": "assistant", "content": tool_raw})
				messages.append({"role": "user", "content": f"[Resultado de herramienta {tool_name}]:\n{tool_result}"})
				continue

			res["tools_used"] = executed_tools
			return res

		res["tools_used"] = executed_tools
		return res
	except Exception as e:
		raise HTTPException(status_code=502, detail=f"LLM proxy error: {str(e)}")

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
