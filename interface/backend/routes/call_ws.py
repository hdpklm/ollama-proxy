import asyncio
import base64
import json
import re
import websockets
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.llm_client import LLMClient
from services.tts_client import TTSClient
from services.sentence_chunker import SentenceChunker
from services.tool_executor import extract_tool_call, execute_tool
from services.tool_definitions import NATIVE_TOOLS
from config import settings, ensure_system_prompt, load_default_system_prompt

def stamp(text: str) -> str:
	dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
	meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
	try:
		now = datetime.now(ZoneInfo("Europe/Madrid"))
	except Exception:
		now = datetime.now().astimezone()
	dia_nombre = dias[now.weekday()]
	mes_nombre = meses[now.month - 1]
	return f"[Fecha y hora actual: {dia_nombre} {now.day} de {mes_nombre} de {now.year}, {now.hour:02d}:{now.minute:02d} {now.tzname()}]\n{text}"

router = APIRouter(tags=["call"])

llm_service = LLMClient()
tts_service = TTSClient()

@router.websocket("/ws/call")
async def websocket_call_endpoint(websocket: WebSocket):
	await websocket.accept()

	conversation_history = [
		{"role": "system", "content": load_default_system_prompt()}
	]
	messages = conversation_history
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

	async def run_assistant_pipeline(user_text: str):
		messages.append({"role": "user", "content": stamp(user_text)})
		await websocket.send_json({"type": "assistant_thinking"})

		max_tool_steps = 3
		executed_tools = []
		for _ in range(max_tool_steps):
			chunker = SentenceChunker(min_words=3, max_words=20)
			accumulated_full_text = ""
			accumulated_tool_calls = []
			chunk_index = 0
			is_streaming_to_tts = False

			try:
				async for chunk in llm_service.stream_chat(conversation_history, tools=NATIVE_TOOLS, priority=True, fast=True):
					if isinstance(chunk, dict):
						if "tool_calls" in chunk:
							accumulated_tool_calls.extend(chunk["tool_calls"])
						continue

					token = str(chunk)
					accumulated_full_text += token

					# Never stream echoed bracketed header or tool_call tags to user or TTS
					if accumulated_full_text.startswith("["):
						if "]" in accumulated_full_text:
							accumulated_full_text = re.sub(r"^\[[^\]]+\]\s*", "", accumulated_full_text)
						else:
							continue

					if "<tool_call" in accumulated_full_text:
						if "</tool_call>" in accumulated_full_text:
							break
						continue

					is_streaming_to_tts = True
					await websocket.send_json({"type": "assistant_token", "token": token})
					for sentence in chunker.push_token(token):
						chunk_index += 1
						if tts_mode == "rpi5":
							audio_bytes = await tts_service.synthesize(sentence)
							if audio_bytes:
								await websocket.send_json({
									"type": "assistant_audio_chunk",
									"chunk_index": chunk_index,
									"audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
									"text": sentence
								})
						else:
							await websocket.send_json({"type": "assistant_sentence", "chunk_index": chunk_index, "text": sentence})

				# 1. Native OpenAI tool calls handling
				if accumulated_tool_calls:
					assistant_msg = {"role": "assistant", "content": None, "tool_calls": accumulated_tool_calls}
					conversation_history.append(assistant_msg)
					for tc in accumulated_tool_calls:
						fn = tc.get("function", {})
						fn_name = fn.get("name", "")
						raw_args = fn.get("arguments", {})
						fn_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
						print(f"[WS Call] Native tool call detected: {fn_name} args={fn_args}")
						await websocket.send_json({"type": "assistant_status", "status": f"Consultando herramienta {fn_name}..."})
						tool_result = await execute_tool(fn_name, fn_args)
						executed_tools.append({"tool": fn_name, "args": fn_args})
						conversation_history.append({
							"role": "tool",
							"tool_call_id": tc.get("id", "call_1"),
							"name": fn_name,
							"content": tool_result
						})
					continue

				# 2. Text fallback tool calls handling
				tool_name, tool_args, tool_raw = extract_tool_call(accumulated_full_text)
				if tool_name and tool_raw:
					print(f"[WS Call] Text fallback tool call detected: {tool_name} args={tool_args}")
					await websocket.send_json({
						"type": "assistant_status",
						"status": f"Consultando herramienta {tool_name}..."
					})
					tool_result = await execute_tool(tool_name, tool_args or {})
					executed_tools.append({"tool": tool_name, "args": tool_args})
					conversation_history.append({"role": "assistant", "content": tool_raw})
					conversation_history.append({"role": "user", "content": f"[Resultado de herramienta {tool_name}]:\n{tool_result}"})
					continue

				if is_streaming_to_tts:
					for sentence in chunker.flush():
						chunk_index += 1
						if tts_mode == "rpi5":
							audio_bytes = await tts_service.synthesize(sentence)
							if audio_bytes:
								await websocket.send_json({
									"type": "assistant_audio_chunk",
									"chunk_index": chunk_index,
									"audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
									"text": sentence
								})
						else:
							await websocket.send_json({"type": "assistant_sentence", "chunk_index": chunk_index, "text": sentence})

				conversation_history.append({"role": "assistant", "content": accumulated_full_text})
				await websocket.send_json({
					"type": "assistant_done",
					"full_text": accumulated_full_text,
					"tools_used": executed_tools
				})
				break


			except asyncio.CancelledError:
				break
			except Exception as e:
				await websocket.send_json({
					"type": "error",
					"message": str(e)
				})
				break

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
	async def stream_tokens(messages: list, model: str, tts_mode: str = "rpi5", priority: bool = False, fast: bool = True):
		max_tool_steps = 3
		last_usage = None
		executed_tools = []
		for _ in range(max_tool_steps):
			accumulated = ""
			accumulated_tool_calls = []
			chunker = SentenceChunker(min_words=2, max_words=20)
			chunk_index = 0
			is_streaming = False

			try:
				async for chunk in llm_service.stream_chat(messages, model=model, tools=NATIVE_TOOLS, priority=priority, fast=fast):
					if isinstance(chunk, dict):
						if "tool_calls" in chunk:
							accumulated_tool_calls.extend(chunk["tool_calls"])
						elif chunk.get("type") == "usage":
							last_usage = chunk
							await websocket.send_json(chunk)
						continue

					token = str(chunk)
					accumulated += token

					# Never stream echoed bracketed header or tool_call tags to user or TTS
					if accumulated.startswith("["):
						if "]" in accumulated:
							accumulated = re.sub(r"^\[[^\]]+\]\s*", "", accumulated)
						else:
							continue

					if "<tool_call" in accumulated:
						if "</tool_call>" in accumulated:
							break
						continue

					is_streaming = True
					await websocket.send_json({"type": "token", "token": token})
					for sentence in chunker.push_token(token):
						chunk_index += 1
						if tts_mode == "rpi5":
							audio_bytes = await tts_service.synthesize(sentence)
							if audio_bytes:
								await websocket.send_json({
									"type": "audio_chunk",
									"chunk_index": chunk_index,
									"audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
									"text": sentence
								})
						else:
							await websocket.send_json({"type": "tts_sentence", "chunk_index": chunk_index, "text": sentence})

				# 1. Native OpenAI tool calls handling
				if accumulated_tool_calls:
					assistant_msg = {"role": "assistant", "content": None, "tool_calls": accumulated_tool_calls}
					messages.append(assistant_msg)
					for tc in accumulated_tool_calls:
						fn = tc.get("function", {})
						fn_name = fn.get("name", "")
						raw_args = fn.get("arguments", {})
						fn_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
						print(f"[WS Chat] Native tool call detected: {fn_name} args={fn_args}")
						await websocket.send_json({"type": "tool_calling", "tool": fn_name, "args": fn_args})
						tool_result = await execute_tool(fn_name, fn_args)
						executed_tools.append({"tool": fn_name, "args": fn_args})
						messages.append({
							"role": "tool",
							"tool_call_id": tc.get("id", "call_1"),
							"name": fn_name,
							"content": tool_result
						})
					continue

				# 2. Text fallback tool calls handling
				tool_name, tool_args, tool_raw = extract_tool_call(accumulated)
				if tool_name and tool_raw:
					print(f"[WS Chat] Text fallback tool call detected: {tool_name} args={tool_args}")
					await websocket.send_json({
						"type": "tool_calling",
						"tool": tool_name,
						"args": tool_args
					})
					tool_result = await execute_tool(tool_name, tool_args or {})
					executed_tools.append({"tool": tool_name, "args": tool_args})
					messages.append({"role": "assistant", "content": tool_raw})
					messages.append({"role": "user", "content": f"[Resultado de herramienta {tool_name}]:\n{tool_result}"})
					continue

				if is_streaming:
					for sentence in chunker.flush():
						chunk_index += 1
						if tts_mode == "rpi5":
							audio_bytes = await tts_service.synthesize(sentence)
							if audio_bytes:
								await websocket.send_json({
									"type": "audio_chunk",
									"chunk_index": chunk_index,
									"audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
									"text": sentence
								})
						else:
							await websocket.send_json({"type": "tts_sentence", "chunk_index": chunk_index, "text": sentence})

				done_msg = {
					"type": "done",
					"full_text": accumulated,
					"tools_used": executed_tools
				}
				if last_usage:
					done_msg["usage"] = last_usage.get("usage")
					done_msg["priority"] = last_usage.get("priority")
					done_msg["times_paused"] = last_usage.get("times_paused")
					done_msg["kv_cache_ram_mb"] = last_usage.get("kv_cache_ram_mb")
				await websocket.send_json(done_msg)
				break

			except asyncio.CancelledError:
				break
			except Exception as e:
				try:
					await websocket.send_json({
						"type": "error",
						"message": str(e)
					})
				except Exception:
					pass
				break

	try:
		while True:
			data = await websocket.receive_json()
			msg_type = data.get("type", "chat")
			if msg_type in ("chat", "send") or "messages" in data:
				if current_stream_task and not current_stream_task.done():
					current_stream_task.cancel()
				raw_messages = data.get("messages", [])
				model = data.get("model", settings.LLM_MODEL)
				tts_mode = data.get("tts_mode", "rpi5")
				priority = bool(data.get("priority", False))
				fast = bool(data.get("fast", True))
				if raw_messages:
					messages = []
					for m in raw_messages:
						if m.get("role") == "user":
							user_text = m.get("content", "")
							if not user_text.startswith(("[Fecha y hora", "[Hora local")):
								messages.append({"role": "user", "content": stamp(user_text)})
							else:
								messages.append(m)
						else:
							messages.append(m)
					messages = ensure_system_prompt(messages)
					current_stream_task = asyncio.create_task(stream_tokens(messages, model, tts_mode, priority=priority, fast=fast))
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
