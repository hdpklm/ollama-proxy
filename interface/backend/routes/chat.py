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
				if not user_text.startswith("["):
					messages.append({"role": "user", "content": stamp(user_text)})
				else:
					messages.append(m)
			else:
				messages.append(m)
		res = await llm_service.chat(messages, model=req.model or "qwen2.5:0.5b")
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
