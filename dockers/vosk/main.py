import os
import io
import json
import zipfile
import requests
from fastapi import FastAPI, Request, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from vosk import Model, KaldiRecognizer

app = FastAPI(title="Vosk STT Microservice", version="0.1.0")

MODELS_DIR = os.getenv("MODELS_DIR", "/app/modelos")
MODEL_PATH = os.path.join(MODELS_DIR, "model")
VOSK_DOWNLOAD_URL = "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip"

model: Model | None = None

def ensure_model_files():
	os.makedirs(MODELS_DIR, exist_ok=True)
	if not os.path.exists(MODEL_PATH) or not os.listdir(MODEL_PATH):
		zip_path = os.path.join(MODELS_DIR, "model.zip")
		resp = requests.get(VOSK_DOWNLOAD_URL, stream=True)
		resp.raise_for_status()
		with open(zip_path, "wb") as f:
			for chunk in resp.iter_content(chunk_size=16384):
				f.write(chunk)

		with zipfile.ZipFile(zip_path, "r") as zip_ref:
			extracted_dirname = zip_ref.namelist()[0].split("/")[0]
			zip_ref.extractall(MODELS_DIR)

		extracted_full_path = os.path.join(MODELS_DIR, extracted_dirname)
		if extracted_full_path != MODEL_PATH:
			if os.path.exists(MODEL_PATH):
				os.rmdir(MODEL_PATH)
			os.rename(extracted_full_path, MODEL_PATH)

		if os.path.exists(zip_path):
			os.remove(zip_path)

@app.on_event("startup")
def startup_event():
	global model
	ensure_model_files()
	model = Model(MODEL_PATH)

@app.get("/health")
def health():
	return {
		"status": "ok",
		"model_loaded": model is not None
	}

@app.post("/")
@app.post("/asr")
async def transcribe_audio_post(request: Request, file: UploadFile | None = File(None)):
	global model
	if not model:
		raise HTTPException(status_code=503, detail="Vosk model not initialized")

	audio_data = b""
	if file:
		audio_data = await file.read()
	else:
		audio_data = await request.body()

	if not audio_data:
		raise HTTPException(status_code=400, detail="Empty audio input")

	recognizer = KaldiRecognizer(model, 16000)
	recognizer.SetWords(True)

	offset = 0
	if audio_data.startswith(b"RIFF") and len(audio_data) > 44:
		offset = 44

	recognizer.AcceptWaveform(audio_data[offset:])
	final_result = json.loads(recognizer.FinalResult())
	return {"text": final_result.get("text", "")}

@app.websocket("/")
@app.websocket("/ws")
async def websocket_asr_endpoint(websocket: WebSocket):
	global model
	if not model:
		await websocket.close(code=1011)
		return

	await websocket.accept()
	recognizer = KaldiRecognizer(model, 16000)

	try:
		while True:
			message = await websocket.receive()
			if "bytes" in message and message["bytes"]:
				pcm_data = message["bytes"]
				if recognizer.AcceptWaveform(pcm_data):
					res = json.loads(recognizer.Result())
					await websocket.send_json({"text": res.get("text", ""), "is_final": True})
				else:
					part = json.loads(recognizer.PartialResult())
					await websocket.send_json({"partial": part.get("partial", ""), "is_final": False})
			elif "text" in message and message["text"]:
				if message["text"] == '{"eof" : 1}':
					final_res = json.loads(recognizer.FinalResult())
					await websocket.send_json({"text": final_res.get("text", ""), "is_final": True})
					break
	except WebSocketDisconnect:
		pass
	except Exception:
		pass

if __name__ == "__main__":
	import uvicorn
	uvicorn.run("main:app", host="0.0.0.0", port=2700, reload=False)
