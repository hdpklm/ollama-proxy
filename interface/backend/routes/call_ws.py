import asyncio
import base64
import json
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.llm_client import LLMClient
from services.tts_client import TTSClient
from services.sentence_chunker import SentenceChunker
from config import settings

router = APIRouter(tags=["call"])

llm_service = LLMClient()
tts_service = TTSClient()

@router.websocket("/ws/call")
async def websocket_call_endpoint(websocket: WebSocket):
	await websocket.accept()

	conversation_history = [
		{"role": "system", "content": "You are a voice assistant in a live phone call. Keep answers concise, clear, and direct."}
	]
	current_task: asyncio.Task | None = None
	tts_mode = "rpi5"
	allow_barge_in = True

	vosk_ws_url = settings.STT_URL.replace("http://", "ws://").replace("https://", "wss://").rstrip("/") + "/ws"
	vosk_ws = None
	vosk_task: asyncio.Task | None = None

	async def cancel_ongoing_assistant():
		nonlocal current_task
		if current_task and not current_task.done():
			current_task.cancel()
			try:
				await current_task
			except asyncio.CancelledError:
				pass
			current_task = None

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

	async def listen_vosk():
		nonlocal current_task
		try:
			async for msg_str in vosk_ws:
				data = json.loads(msg_str)
				is_final = bool(data.get("is_final", False))
				text = data.get("text", "") if is_final else data.get("partial", "")
				text = text.strip()
				if not text:
					continue

				# Send live partial or final transcript to the client so the user sees what they speak
				await websocket.send_json({
					"type": "user_transcript",
					"text": text,
					"is_final": is_final
				})

				# If final phrase completed, trigger LLM response
				if is_final:
					if not allow_barge_in and current_task and not current_task.done():
						continue
					await cancel_ongoing_assistant()
					current_task = asyncio.create_task(run_assistant_pipeline(text))
				elif allow_barge_in and current_task and not current_task.done() and len(text) > 3:
					# User began speaking while assistant was talking -> interrupt immediately
					await cancel_ongoing_assistant()

		except (asyncio.CancelledError, websockets.ConnectionClosed):
			pass
		except Exception as e:
			print(f"[WS Call] Vosk listen error: {e}")

	try:
		vosk_ws = await websockets.connect(vosk_ws_url, ping_interval=20, ping_timeout=20)
		vosk_task = asyncio.create_task(listen_vosk())
		print(f"[WS Call] Connected to Vosk streaming WebSocket at {vosk_ws_url}")
	except Exception as e:
		print(f"[WS Call] Warning: Could not connect to Vosk WS ({vosk_ws_url}): {e}")

	try:
		while True:
			message = await websocket.receive()
			msg_type_raw = message.get("type")
			if msg_type_raw == "websocket.disconnect":
				print("[WS Call] Client sent disconnect message")
				break

			if "bytes" in message and message["bytes"]:
				pcm_data = message["bytes"]
				if not allow_barge_in and current_task and not current_task.done():
					continue
				if vosk_ws and not vosk_ws.closed:
					await vosk_ws.send(pcm_data)

			elif "text" in message and message["text"]:
				try:
					payload = json.loads(message["text"])
				except json.JSONDecodeError:
					continue

				msg_type = payload.get("type")

				if msg_type == "audio_chunk":
					if not allow_barge_in and current_task and not current_task.done():
						continue
					b64_data = payload.get("data", "")
					if b64_data and vosk_ws and not vosk_ws.closed:
						raw_data = base64.b64decode(b64_data)
						await vosk_ws.send(raw_data)

				elif msg_type == "config":
					tts_mode = payload.get("tts_mode", tts_mode)
					allow_barge_in = bool(payload.get("allow_barge_in", allow_barge_in))
					print(f"[WS Call] Configured TTS mode: {tts_mode}, allow_barge_in: {allow_barge_in}")

				elif msg_type == "user_text":
					if not allow_barge_in and current_task and not current_task.done():
						continue
					text = payload.get("text", "").strip()
					if text:
						await cancel_ongoing_assistant()
						current_task = asyncio.create_task(run_assistant_pipeline(text))

				elif msg_type == "interrupt":
					await cancel_ongoing_assistant()

				elif msg_type == "reset":
					await cancel_ongoing_assistant()
					conversation_history = [
						{"role": "system", "content": "You are a voice assistant in a live phone call. Keep answers concise, clear, and direct."}
					]

	except WebSocketDisconnect as e:
		print(f"[WS Call] Disconnected: code={e.code}")
	except Exception as e:
		print(f"[WS Call Error] Unexpected exception: {e}")
		import traceback
		traceback.print_exc()
	finally:
		await cancel_ongoing_assistant()
		if vosk_task and not vosk_task.done():
			vosk_task.cancel()
		if vosk_ws and not vosk_ws.closed:
			try:
				await vosk_ws.close()
			except Exception:
				pass
