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
	client_is_playing = False

	def is_assistant_busy() -> bool:
		return (current_task is not None and not current_task.done()) or client_is_playing

	vosk_ws_url = settings.STT_URL.replace("http://", "ws://").replace("https://", "wss://").rstrip("/") + "/ws"
	vosk_ws = None
	vosk_task: asyncio.Task | None = None

	async def cancel_ongoing_assistant():
		nonlocal current_task, client_is_playing
		client_is_playing = False
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
		nonlocal current_task, vosk_ws
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
					if not allow_barge_in and is_assistant_busy():
						continue
					await cancel_ongoing_assistant()
					current_task = asyncio.create_task(run_assistant_pipeline(text))

		except (asyncio.CancelledError, websockets.ConnectionClosed):
			pass
		except Exception as e:
			print(f"[WS Call] Vosk listen error: {e}")
		finally:
			vosk_ws = None

	async def ensure_vosk():
		nonlocal vosk_ws, vosk_task
		if vosk_ws is None:
			try:
				vosk_ws = await websockets.connect(vosk_ws_url, ping_interval=20, ping_timeout=20)
				vosk_task = asyncio.create_task(listen_vosk())
				print(f"[WS Call] Connected to Vosk streaming WebSocket at {vosk_ws_url}")
			except Exception as e:
				print(f"[WS Call] Warning: Could not connect to Vosk WS ({vosk_ws_url}): {e}")
				vosk_ws = None
		return vosk_ws

	# Pre-connect to Vosk
	await ensure_vosk()

	try:
		while True:
			message = await websocket.receive()
			msg_type_raw = message.get("type")
			if msg_type_raw == "websocket.disconnect":
				print("[WS Call] Client sent disconnect message")
				break

			if "bytes" in message and message["bytes"]:
				pcm_data = message["bytes"]
				if not allow_barge_in and is_assistant_busy():
					continue
				conn = await ensure_vosk()
				if conn:
					try:
						await conn.send(pcm_data)
					except Exception as send_err:
						print(f"[WS Call] Vosk send error: {send_err}")
						vosk_ws = None

			elif "text" in message and message["text"]:
				try:
					payload = json.loads(message["text"])
				except json.JSONDecodeError:
					continue

				msg_type = payload.get("type")

				if msg_type == "audio_chunk":
					if not allow_barge_in and is_assistant_busy():
						continue
					b64_data = payload.get("data", "")
					if b64_data:
						conn = await ensure_vosk()
						if conn:
							raw_data = base64.b64decode(b64_data)
							try:
								await conn.send(raw_data)
							except Exception as send_err:
								print(f"[WS Call] Vosk chunk send error: {send_err}")
								vosk_ws = None

				elif msg_type == "playback_status":
					client_is_playing = bool(payload.get("is_playing", False))

				elif msg_type == "config":
					tts_mode = payload.get("tts_mode", tts_mode)
					allow_barge_in = bool(payload.get("allow_barge_in", allow_barge_in))
					print(f"[WS Call] Configured TTS mode: {tts_mode}, allow_barge_in: {allow_barge_in}")

				elif msg_type == "user_text":
					if not allow_barge_in and is_assistant_busy():
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
		if vosk_ws:
			try:
				await vosk_ws.close()
			except Exception:
				pass
			vosk_ws = None

@router.websocket("/ws/stt")
async def websocket_stt_endpoint(websocket: WebSocket):
	await websocket.accept()

	vosk_ws_url = settings.STT_URL.replace("http://", "ws://").replace("https://", "wss://").rstrip("/") + "/ws"
	vosk_ws = None
	vosk_task: asyncio.Task | None = None

	async def listen_vosk():
		nonlocal vosk_ws
		try:
			async for msg_str in vosk_ws:
				data = json.loads(msg_str)
				is_final = bool(data.get("is_final", False))
				text = data.get("text", "") if is_final else data.get("partial", "")
				text = text.strip()
				if text:
					await websocket.send_json({
						"type": "transcript",
						"text": text,
						"is_final": is_final
					})
		except (asyncio.CancelledError, websockets.ConnectionClosed):
			pass
		except Exception as e:
			print(f"[WS STT] Vosk listen error: {e}")
		finally:
			vosk_ws = None

	async def ensure_vosk():
		nonlocal vosk_ws, vosk_task
		if vosk_ws is None:
			try:
				vosk_ws = await websockets.connect(vosk_ws_url, ping_interval=20, ping_timeout=20)
				vosk_task = asyncio.create_task(listen_vosk())
				print(f"[WS STT] Connected to Vosk streaming at {vosk_ws_url}")
			except Exception as e:
				print(f"[WS STT] Warning: Could not connect to Vosk WS ({vosk_ws_url}): {e}")
				vosk_ws = None
		return vosk_ws

	await ensure_vosk()

	try:
		while True:
			message = await websocket.receive()
			msg_type_raw = message.get("type")
			if msg_type_raw == "websocket.disconnect":
				break

			if "bytes" in message and message["bytes"]:
				pcm_data = message["bytes"]
				conn = await ensure_vosk()
				if conn:
					try:
						await conn.send(pcm_data)
					except Exception as send_err:
						print(f"[WS STT] Vosk send error: {send_err}")
						vosk_ws = None

			elif "text" in message and message["text"]:
				if message["text"] in ('{"eof": 1}', 'stop'):
					conn = await ensure_vosk()
					if conn:
						try:
							await conn.send('{"eof" : 1}')
						except Exception:
							pass

	except WebSocketDisconnect:
		pass
	except Exception as e:
		print(f"[WS STT Error] Unexpected exception: {e}")
	finally:
		if vosk_task and not vosk_task.done():
			vosk_task.cancel()
		if vosk_ws:
			try:
				await vosk_ws.close()
			except Exception:
				pass
			vosk_ws = None

@router.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket):
	await websocket.accept()
	current_stream_task: asyncio.Task | None = None

	async def stream_tokens(messages: list, model: str, tts_mode: str = "rpi5"):
		accumulated = ""
		chunker = SentenceChunker(min_words=2, max_words=20)
		chunk_index = 0
		try:
			async for token in llm_service.stream_chat(messages, model=model):
				accumulated += token
				await websocket.send_json({
					"type": "token",
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
								"type": "audio_chunk",
								"chunk_index": chunk_index,
								"audio_base64": b64_audio,
								"text": sentence
							})
					else:
						await websocket.send_json({
							"type": "tts_sentence",
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
							"type": "audio_chunk",
							"chunk_index": chunk_index,
							"audio_base64": b64_audio,
							"text": sentence
						})
				else:
					await websocket.send_json({
						"type": "tts_sentence",
						"chunk_index": chunk_index,
						"text": sentence
					})

			await websocket.send_json({
				"type": "done",
				"full_text": accumulated
			})
		except asyncio.CancelledError:
			pass
		except Exception as e:
			try:
				await websocket.send_json({
					"type": "error",
					"message": str(e)
				})
			except Exception:
				pass

	try:
		while True:
			data = await websocket.receive_json()
			msg_type = data.get("type", "chat")
			if msg_type in ("chat", "send") or "messages" in data:
				if current_stream_task and not current_stream_task.done():
					current_stream_task.cancel()
				messages = data.get("messages", [])
				model = data.get("model", settings.LLM_MODEL)
				tts_mode = data.get("tts_mode", "rpi5")
				if messages:
					current_stream_task = asyncio.create_task(stream_tokens(messages, model, tts_mode))
			elif msg_type == "stop":
				if current_stream_task and not current_stream_task.done():
					current_stream_task.cancel()
	except WebSocketDisconnect:
		pass
	except Exception as e:
		print(f"[WS Chat Error] {e}")
	finally:
		if current_stream_task and not current_stream_task.done():
			current_stream_task.cancel()
