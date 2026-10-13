import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import settings
from routes.chat import router as chat_router
from routes.call_ws import router as call_router

app = FastAPI(title="Voice & Chat LLM Interface", version="0.6.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(call_router)

@app.get("/api/health")
async def health_check():
	return {
		"status": "ok",
		"version": "0.6.0",
		"services": {
			"llm_url": settings.LLM_URL,
			"tts_url": settings.TTS_URL,
			"stt_url": settings.STT_URL
		}
	}

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
	app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

	@app.get("/{full_path:path}")
	async def serve_spa(full_path: str):
		target = os.path.join(frontend_dist, full_path)
		if os.path.exists(target) and os.path.isfile(target):
			return FileResponse(target)
		return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
	import uvicorn
	uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=False)
