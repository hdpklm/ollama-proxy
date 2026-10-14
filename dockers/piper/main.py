import os
import io
import wave
import requests
from fastapi import FastAPI, Request, Response, HTTPException
from piper.voice import PiperVoice

app = FastAPI(title="Piper TTS Microservice", version="0.1.0")

MODELS_DIR = os.getenv("MODELS_DIR", "/app/modelos")
VOICE_NAME = os.getenv("VOICE_NAME", "es_ES-sharvard-medium")
HF_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_ES/sharvard/medium"

model_path = os.path.join(MODELS_DIR, f"{VOICE_NAME}.onnx")
config_path = os.path.join(MODELS_DIR, f"{VOICE_NAME}.onnx.json")

voice: PiperVoice | None = None

def ensure_model_files():
	os.makedirs(MODELS_DIR, exist_ok=True)
	if not os.path.exists(model_path):
		url = f"{HF_BASE_URL}/{VOICE_NAME}.onnx"
		resp = requests.get(url, stream=True)
		resp.raise_for_status()
		with open(model_path, "wb") as f:
			for chunk in resp.iter_content(chunk_size=8192):
				f.write(chunk)

	if not os.path.exists(config_path):
		url = f"{HF_BASE_URL}/{VOICE_NAME}.onnx.json"
		resp = requests.get(url, stream=True)
		resp.raise_for_status()
		with open(config_path, "wb") as f:
			for chunk in resp.iter_content(chunk_size=8192):
				f.write(chunk)

@app.on_event("startup")
def startup_event():
	global voice
	ensure_model_files()
	voice = PiperVoice.load(model_path, config_path=config_path)

@app.get("/health")
def health():
	return {
		"status": "ok",
		"voice": VOICE_NAME,
		"loaded": voice is not None
	}

def create_empty_wav(sample_rate: int = 22050) -> bytes:
	buf = io.BytesIO()
	with wave.open(buf, "wb") as wf:
		wf.setnchannels(1)
		wf.setsampwidth(2)
		wf.setframerate(sample_rate)
	return buf.getvalue()

def synthesize_text_to_wav(text: str) -> bytes:
	global voice
	if not voice:
		raise HTTPException(status_code=503, detail="Voice model not initialized")

	sample_rate = getattr(getattr(voice, "config", None), "sample_rate", 22050)

	# Avoid Piper empty phonemes bug on text with only punctuation or whitespace
	if not any(c.isalnum() for c in text):
		return create_empty_wav(sample_rate)

	buffer = io.BytesIO()
	with wave.open(buffer, "wb") as wav_file:
		wav_file.setnchannels(1)
		wav_file.setsampwidth(2)
		wav_file.setframerate(sample_rate)
		voice.synthesize(text, wav_file)
	return buffer.getvalue()

@app.post("/")
async def tts_post(request: Request):
	body_bytes = await request.body()
	text = ""
	try:
		json_data = await request.json()
		text = json_data.get("text", "")
	except Exception:
		text = body_bytes.decode("utf-8", errors="ignore").strip()

	if not text:
		raise HTTPException(status_code=400, detail="Empty text prompt")

	wav_bytes = synthesize_text_to_wav(text)
	return Response(content=wav_bytes, media_type="audio/wav")

@app.get("/")
@app.get("/api/tts")
def tts_get(text: str = ""):
	if not text.strip():
		raise HTTPException(status_code=400, detail="Empty text query")
	wav_bytes = synthesize_text_to_wav(text.strip())
	return Response(content=wav_bytes, media_type="audio/wav")

if __name__ == "__main__":
	import uvicorn
	uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=False)
