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

class TTSRequest(BaseModel):
	text: str
	voice: str | None = None

@router.post("/chat")
async def handle_chat(req: ChatRequest):
	try:
		messages = []
		for m in req.messages:
			if m.get("role") == "user":
				user_text = m.get("content", "")
				if not user_text.startswith("[Hora local"):
					messages.append({"role": "user", "content": stamp(user_text)})
				else:
					messages.append(m)
			else:
				messages.append(m)
		messages = ensure_system_prompt(messages)

		# Autonomous tool calling loop (up to 3 steps)
		selected_model = req.model or settings.LLM_MODEL or "gemma4:e2b"
		for _ in range(3):
			res = await llm_service.chat(messages, model=selected_model)
			msg = res.get("message", {})
			content = msg.get("content", "")

			tool_name, tool_args, tool_raw = extract_tool_call(content)
			if tool_name and tool_raw:
				tool_result = await execute_tool(tool_name, tool_args or {})
				messages.append({"role": "assistant", "content": tool_raw})
				messages.append({"role": "user", "content": f"[Resultado de herramienta {tool_name}]:\n{tool_result}"})
				continue

			return res

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
