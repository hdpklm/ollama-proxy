import asyncio
import base64
import json
import io
import wave
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.llm_client import LLMClient
from services.tts_client import TTSClient
from services.stt_client import STTClient
from services.sentence_chunker import SentenceChunker
from config import settings

router = APIRouter(tags=["call"])

llm_service = LLMClient()
tts_service = TTSClient()
stt_service = STTClient()

@router.websocket("/ws/call")
async def websocket_call_endpoint(websocket: WebSocket):
	await websocket.accept()

	conversation_history = [
		{"role": "system", "content": "You are a voice assistant in a live phone call. Keep answers concise, clear, and direct."}
	]
	current_task: asyncio.Task | None = None
	audio_buffer = bytearray()
	silence_timer_task: asyncio.Task | None = None

	def pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000) -> bytes:
		buf = io.BytesIO()
		with wave.open(buf, "wb") as wf:
			wf.setnchannels(1)
			wf.setsampwidth(2)
			wf.setframerate(sample_rate)
			wf.writeframes(pcm_data)
		return buf.getvalue()

	async def cancel_ongoing_assistant():
		nonlocal current_task
		if current_task and not current_task.done():
			current_task.cancel()
			try:
				await current_task
			except asyncio.CancelledError:
				pass
			current_task = None

	async def process_user_speech():
		nonlocal audio_buffer, current_task
		if len(audio_buffer) < 3200:
			audio_buffer.clear()
			return

		raw_bytes = bytes(audio_buffer)
		audio_buffer.clear()

		wav_bytes = pcm_to_wav(raw_bytes) if not raw_bytes.startswith(b"RIFF") else raw_bytes
		transcript = await stt_service.transcribe_audio(wav_bytes)
		transcript = transcript.strip()

		if not transcript:
			return

		await websocket.send_json({
			"type": "user_transcript",
			"text": transcript,
			"is_final": True
		})

		await cancel_ongoing_assistant()
		current_task = asyncio.create_task(run_assistant_pipeline(transcript))

	async def on_silence_timeout():
		await asyncio.sleep(settings.SILENCE_TIMEOUT_MS / 1000.0)
		await process_user_speech()

	tts_mode = "rpi5"

	async def run_assistant_pipeline(user_prompt: str):
		conversation_history.append({"role": "user", "content": user_prompt})
		await websocket.send_json({"type": "assistant_thinking"})

		chunker = SentenceChunker(min_words=3, max_words=20)
		accumulated_full_text = ""
		token_count = 0
		chunk_index = 0

		try:
			async for token in llm_service.stream_chat(conversation_history):
				token_count += 1
				accumulated_full_text += token

				await websocket.send_json({
					"type": "assistant_token",
					"token": token
				})

				sentences = chunker.push_token(token)
				for sentence in sentences:
					chunk_index += 1
					if tts_mode == "rpi5":
						audio_bytes = await tts_service.synthesize(sentence)
						if audio_bytes:
							b64_audio = base64.b64encode(audio_bytes).decode("ascii")
							await websocket.send_json({
								"type": "assistant_audio_chunk",
								"chunk_index": chunk_index,
								"audio_base64": b64_audio,
								"text": sentence
							})
					else:
						await websocket.send_json({
							"type": "assistant_sentence",
							"chunk_index": chunk_index,
							"text": sentence
						})

			final_sentences = chunker.flush()
			for sentence in final_sentences:
				chunk_index += 1
				if tts_mode == "rpi5":
					audio_bytes = await tts_service.synthesize(sentence)
					if audio_bytes:
						b64_audio = base64.b64encode(audio_bytes).decode("ascii")
						await websocket.send_json({
							"type": "assistant_audio_chunk",
							"chunk_index": chunk_index,
							"audio_base64": b64_audio,
							"text": sentence
						})
				else:
					await websocket.send_json({
						"type": "assistant_sentence",
						"chunk_index": chunk_index,
						"text": sentence
					})

			conversation_history.append({"role": "assistant", "content": accumulated_full_text})
			await websocket.send_json({
				"type": "assistant_done",
				"full_text": accumulated_full_text
			})

		except asyncio.CancelledError:
			pass
		except Exception as e:
			await websocket.send_json({
				"type": "error",
				"message": str(e)
			})

	try:
		while True:
			message = await websocket.receive()
			if "bytes" in message and message["bytes"]:
				data = message["bytes"]
				audio_buffer.extend(data)

				if silence_timer_task and not silence_timer_task.done():
					silence_timer_task.cancel()
				silence_timer_task = asyncio.create_task(on_silence_timeout())

			elif "text" in message and message["text"]:
				try:
					payload = json.loads(message["text"])
				except json.JSONDecodeError:
					continue

				msg_type = payload.get("type")

				if msg_type == "audio_chunk":
					b64_data = payload.get("data", "")
					if b64_data:
						raw_data = base64.b64decode(b64_data)
						audio_buffer.extend(raw_data)
						if silence_timer_task and not silence_timer_task.done():
							silence_timer_task.cancel()
						silence_timer_task = asyncio.create_task(on_silence_timeout())

				elif msg_type == "config":
					tts_mode = payload.get("tts_mode", tts_mode)

				elif msg_type == "user_text":
					text = payload.get("text", "").strip()
					if text:
						await cancel_ongoing_assistant()
						current_task = asyncio.create_task(run_assistant_pipeline(text))

				elif msg_type == "interrupt":
					await cancel_ongoing_assistant()
					audio_buffer.clear()
					if silence_timer_task and not silence_timer_task.done():
						silence_timer_task.cancel()

				elif msg_type == "reset":
					await cancel_ongoing_assistant()
					audio_buffer.clear()
					conversation_history = [
						{"role": "system", "content": "You are a voice assistant in a live phone call. Keep answers concise, clear, and direct."}
					]

	except WebSocketDisconnect:
		await cancel_ongoing_assistant()
	except Exception:
		await cancel_ongoing_assistant()
