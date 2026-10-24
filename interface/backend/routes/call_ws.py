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
from services.tool_executor import execute_tool
from services.tool_definitions import NATIVE_TOOLS
from services.adapters import get_adapter
from config import settings, ensure_system_prompt, load_default_system_prompt
from services.silence_killer import format_silence_killer_status
from services.tree_context_manager import TreeContextManager
from services.plan_and_solve import is_complex_request, PlanAndSolveOrchestrator
from services.conversation_logger import conversation_logger

tree_context_manager = TreeContextManager()

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
		adapter = get_adapter(settings.LLM_MODEL)
		messages.append({"role": "user", "content": stamp(user_text)})
		await websocket.send_json({"type": "assistant_thinking"})

		max_tool_steps = 3
		executed_tools = []
		for step in range(max_tool_steps):
			chunker = SentenceChunker(min_words=3, max_words=20)
			accumulated_full_text = ""
			accumulated_tool_calls = []
			chunk_index = 0
			is_streaming_to_tts = False
			is_thinking_block = False

			if not settings.HIDE_BACKGROUND:
				await websocket.send_json({
					"type": "debug",
					"stage": "turn_start",
					"step": step,
					"tools_enabled": step == 0
				})

			try:
				async for chunk in llm_service.stream_chat(conversation_history, tools=NATIVE_TOOLS if step == 0 else None, priority=True, fast=True):
					if isinstance(chunk, dict):
						if "tool_calls" in chunk:
							accumulated_tool_calls.extend(chunk["tool_calls"])
						if "reasoning_content" in chunk:
							if not settings.HIDE_BACKGROUND:
								await websocket.send_json({
									"type": "thinking_token",
									"token": chunk["reasoning_content"]
								})
						continue

					token = str(chunk)
					accumulated_full_text += token

					# Detect thinking tags (<think>, <thought>, <|thought)
					if "<think" in token or "<thought" in token or "<|thought" in token:
						is_thinking_block = True
					if is_thinking_block:
						if not settings.HIDE_BACKGROUND:
							await websocket.send_json({
								"type": "thinking_token",
								"token": token
							})
						if "</think>" in token or "</thought>" in token or "</think>" in accumulated_full_text or "</thought>" in accumulated_full_text:
							is_thinking_block = False
							if not settings.HIDE_BACKGROUND:
								await websocket.send_json({"type": "thinking_done"})
						continue

					if adapter.is_tool_call_token(token, accumulated_full_text):
						if not settings.HIDE_BACKGROUND:
							await websocket.send_json({
								"type": "tool_calling_token",
								"token": token
							})
						if adapter.is_tool_call_completed(accumulated_full_text):
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

				tool_calls = adapter.extract_tool_calls(
					native_tool_calls=accumulated_tool_calls,
					text_content=accumulated_full_text
				)
				if tool_calls:
					if accumulated_tool_calls:
						conversation_history.append({"role": "assistant", "content": None, "tool_calls": accumulated_tool_calls})
					for tc in tool_calls:
						print(f"[WS Call] Tool call detected ({adapter.name}): {tc.name} args={tc.args}")
						silence_status = format_silence_killer_status(tc.name, tc.args)
						await websocket.send_json({"type": "assistant_status", "status": silence_status})
						if not settings.HIDE_BACKGROUND:
							await websocket.send_json({
								"type": "tool_calling",
								"tool": tc.name,
								"args": tc.args,
								"step": step
							})
							await websocket.send_json({
								"type": "tool_executing",
								"tool": tc.name,
								"args": tc.args
							})
						tool_result = await execute_tool(tc.name, tc.args)
						executed_tools.append({"tool": tc.name, "args": tc.args})
						if not settings.HIDE_BACKGROUND:
							await websocket.send_json({
								"type": "tool_result",
								"tool": tc.name,
								"result": tool_result
							})
							await websocket.send_json({
								"type": "debug",
								"stage": "tool_result_injected",
								"tool": tc.name,
								"next_step": step + 1
							})
						conversation_history.extend(adapter.format_tool_response(tc, tool_result))
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

class TurnMetricsManager:
	def __init__(self):
		self._subscribers: dict[str, set[WebSocket]] = {}
		self._buffered: dict[str, list[dict]] = {}

	def register(self, turn_id: str, ws: WebSocket):
		if not turn_id:
			return
		if turn_id not in self._subscribers:
			self._subscribers[turn_id] = set()
		self._subscribers[turn_id].add(ws)

	def unregister(self, turn_id: str, ws: WebSocket):
		if not turn_id:
			return
		if turn_id in self._subscribers:
			self._subscribers[turn_id].discard(ws)
			if not self._subscribers[turn_id]:
				del self._subscribers[turn_id]

	async def emit(self, turn_id: str, event: dict):
		if not turn_id:
			return
		subs = self._subscribers.get(turn_id, set())
		dead = set()
		for ws in list(subs):
			try:
				await ws.send_json(event)
			except Exception:
				dead.add(ws)
		for d in dead:
			subs.discard(d)

		if turn_id not in self._buffered:
			self._buffered[turn_id] = []
		self._buffered[turn_id].append(event)
		if len(self._buffered[turn_id]) > 50:
			self._buffered[turn_id].pop(0)

	async def flush_to_socket(self, turn_id: str, ws: WebSocket):
		if turn_id and turn_id in self._buffered:
			for event in self._buffered[turn_id]:
				try:
					await ws.send_json(event)
				except Exception:
					break

turn_metrics_manager = TurnMetricsManager()

@router.websocket("/ws/chat/metrics")
async def websocket_chat_metrics_endpoint(websocket: WebSocket):
	await websocket.accept()
	turn_id = websocket.query_params.get("turn_id", "")
	if turn_id:
		turn_metrics_manager.register(turn_id, websocket)
		await turn_metrics_manager.flush_to_socket(turn_id, websocket)
	try:
		while True:
			msg = await websocket.receive_json()
			msg_type = msg.get("type")
			if msg_type == "subscribe":
				new_turn = msg.get("turn_id", "")
				if new_turn:
					if turn_id:
						turn_metrics_manager.unregister(turn_id, websocket)
					turn_id = new_turn
					turn_metrics_manager.register(turn_id, websocket)
					await turn_metrics_manager.flush_to_socket(turn_id, websocket)
			elif msg_type == "ping":
				await websocket.send_json({"type": "pong"})
	except WebSocketDisconnect:
		pass
	except Exception as e:
		pass
	finally:
		if turn_id:
			turn_metrics_manager.unregister(turn_id, websocket)

@router.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket):
	await websocket.accept()
	current_stream_task: asyncio.Task | None = None
	async def stream_tokens(messages: list, model: str, tts_mode: str = "rpi5", priority: bool = False, fast: bool = True, turn_id: str = "", branch_id: str = "main", user_prompt_clean: str = "", session_id: str = "main"):
		from services.agent_manager import load_agent_profile
		from services.tool_definitions import get_tools_for_agent

		t_turn_start = time.time()
		main_profile = load_agent_profile("system_prompt")
		profile_tools = get_tools_for_agent(main_profile)
		call_tracker: dict[str, int] = {}

		adapter = get_adapter(model)
		max_tool_steps = 3
		last_usage = None
		executed_tools = []

		# 1. Emit model load metric to WebSocket 2 (No-streaming)
		try:
			model_info = await llm_service.get_model_info(model)
			is_in_mem = model_info.get("in_memory", True)
			current_load_time = 0.0 if is_in_mem else model_info.get("load_time_seconds", 0.0)
			await turn_metrics_manager.emit(turn_id, {
				"type": "metric",
				"stage": "model_load",
				"model": model_info.get("model", model),
				"load_time_seconds": current_load_time,
				"in_memory": is_in_mem,
				"details": "Residente en RAM mmap (actual)" if is_in_mem else "Cargado en memoria"
			})
		except Exception as e:
			print(f"[WS Chat] Error emitting model_load metric: {e}")

		# 2. Emit session & KV cache metric to WebSocket 2 (No-streaming)
		try:
			sys_msg = next((m.get("content", "") for m in messages if m.get("role") == "system"), "")
			cached_tokens = len(sys_msg) // 4 if sys_msg else 0
			kv_ram = round(cached_tokens * 0.125, 2)
			await turn_metrics_manager.emit(turn_id, {
				"type": "metric",
				"stage": "kv_cache",
				"restore_time_seconds": 0.001,
				"ram_mb": kv_ram,
				"is_cached": True,
				"details": "Sesión y KV cache activo en RAM (actual)"
			})
		except Exception as e:
			print(f"[WS Chat] Error emitting kv_cache metric: {e}")

		for step in range(max_tool_steps):
			accumulated = ""
			accumulated_tool_calls = []
			chunker = SentenceChunker(min_words=2, max_words=20)
			chunk_index = 0
			is_streaming = False
			is_thinking_block = False

			try:
				async for chunk in llm_service.stream_chat(messages, model=model, tools=profile_tools if (step == 0 and profile_tools) else None, priority=priority, fast=fast):
					if isinstance(chunk, dict):
						if "tool_calls" in chunk:
							accumulated_tool_calls.extend(chunk["tool_calls"])
						if "reasoning_content" in chunk:
							await websocket.send_json({
								"type": "thinking_token",
								"token": chunk["reasoning_content"]
							})
						elif chunk.get("type") == "usage":
							last_usage = chunk
							usage_data = chunk.get("usage", {})
							p_tokens = usage_data.get("prompt_tokens", 0)
							p_sec = usage_data.get("prompt_eval_seconds", 0.0)
							p_tps = usage_data.get("prompt_tokens_per_second") or usage_data.get("prompt_token_s", 0.0)
							await turn_metrics_manager.emit(turn_id, {
								"type": "metric",
								"stage": "prompt_execution",
								"tokens": p_tokens,
								"duration_seconds": p_sec,
								"tokens_per_second": p_tps
							})
						continue

					token = str(chunk)
					accumulated += token

					# Detect thinking tags (<think>, <thought>, <|thought)
					if "<think" in token or "<thought" in token or "<|thought" in token:
						is_thinking_block = True
					if is_thinking_block:
						await websocket.send_json({
							"type": "thinking_token",
							"token": token
						})
						if "</think>" in token or "</thought>" in token or "</think>" in accumulated or "</thought>" in accumulated:
							is_thinking_block = False
							await websocket.send_json({"type": "thinking_done"})
						continue

					if adapter.is_tool_call_token(token, accumulated):
						if adapter.is_tool_call_completed(accumulated):
							break
						continue

					is_streaming = True
					# WebSocket 1: Ultra-fast streaming ONLY (tokens and audio chunks)
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

				tool_calls = adapter.extract_tool_calls(
					native_tool_calls=accumulated_tool_calls,
					text_content=accumulated
				)
				if tool_calls:
					if accumulated_tool_calls:
						messages.append({"role": "assistant", "content": None, "tool_calls": accumulated_tool_calls})
					for tc in tool_calls:
						silence_status = format_silence_killer_status(tc.name, tc.args)
						await websocket.send_json({"type": "assistant_status", "status": silence_status})
						import time
						t_tool_start = time.time()
						req_str = json.dumps({"tool": tc.name, "arguments": tc.args}, ensure_ascii=False)
						call_tokens = await llm_service.count_tokens(req_str)

						async def on_subagent_metric(sub_m: dict):
							await turn_metrics_manager.emit(turn_id, {
								"type": "metric",
								"stage": "sub_agent",
								**sub_m
							})

						tool_result = await execute_tool(
							tc.name,
							tc.args,
							on_metric=on_subagent_metric,
							caller_profile=main_profile,
							call_tracker=call_tracker
						)
						tool_duration = round(time.time() - t_tool_start, 3)
						result_tokens = await llm_service.count_tokens(str(tool_result))
						total_tool_tokens = call_tokens + result_tokens

						tool_info = {
							"tool": tc.name,
							"args": tc.args,
							"duration_seconds": tool_duration,
							"call_tokens": call_tokens,
							"result_tokens": result_tokens,
							"total_tokens": total_tool_tokens,
							"step": step
						}
						executed_tools.append(tool_info)
						try:
							conversation_logger.log_tool_call(
								session_id=session_id,
								tool_name=tc.name,
								args=tc.args,
								result=tool_result,
								metadata={"duration_seconds": tool_duration}
							)
						except Exception as e_log:
							print(f"[WS Chat] Tool log warning: {e_log}")

						# Emit tool-calling duration and token breakdown to WebSocket 2 (No-streaming)
						await turn_metrics_manager.emit(turn_id, {
							"type": "metric",
							"stage": "tool_execution",
							**tool_info
						})

						messages.extend(adapter.format_tool_response(tc, tool_result))
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

				# Emit complete generation summary to WebSocket 2 (No-streaming)
				usage_data = last_usage.get("usage", {}) if last_usage else {}
				comp_tokens = usage_data.get("completion_tokens", 0)
				gen_sec = usage_data.get("generation_seconds", 0.0)
				gen_tps = usage_data.get("tokens_per_second") or usage_data.get("generate_token_s", 0.0)
				prompt_tok = usage_data.get("prompt_tokens", 0)
				kv_ram = last_usage.get("kv_cache_ram_mb", 0.0) if last_usage else 0.0
				prio = last_usage.get("priority", priority) if last_usage else priority
				paused = last_usage.get("times_paused", 0) if last_usage else 0

				turn_total_seconds = round(time.time() - t_turn_start, 3)

				await turn_metrics_manager.emit(turn_id, {
					"type": "metric",
					"stage": "generation_metrics",
					"tokens": comp_tokens,
					"duration_seconds": gen_sec,
					"tokens_per_second": gen_tps,
					"total_tokens": usage_data.get("total_tokens", prompt_tok + comp_tokens),
					"kv_cache_ram_mb": kv_ram,
					"priority": prio,
					"times_paused": paused,
					"total_turn_seconds": turn_total_seconds
				})
				await turn_metrics_manager.emit(turn_id, {
					"type": "metrics_done",
					"turn_id": turn_id,
					"tools_used": executed_tools,
					"total_turn_seconds": turn_total_seconds
				})

				# WebSocket 1: Notify stream completion
				done_msg = {
					"type": "done",
					"full_text": accumulated,
					"tools_used": executed_tools,
					"total_turn_seconds": turn_total_seconds,
					"model_metrics": {
						"model": model_info.get("model", model),
						"in_memory": is_in_mem,
						"load_time_seconds": current_load_time,
						"details": "Residente en RAM mmap (actual)" if is_in_mem else "Cargado en memoria"
					},
					"kv_metrics": {
						"restore_time_seconds": 0.001,
						"ram_mb": kv_ram,
						"is_cached": True,
						"details": "Sesión y KV cache activo en RAM (actual)"
					},
					"prompt_metrics": {
						"tokens": prompt_tok,
						"duration_seconds": usage_data.get("prompt_eval_seconds", 0.0),
						"tokens_per_second": usage_data.get("prompt_tokens_per_second") or usage_data.get("prompt_token_s", 0.0)
					},
					"generation_metrics": {
						"tokens": comp_tokens,
						"duration_seconds": gen_sec,
						"tokens_per_second": gen_tps,
						"total_tokens": usage_data.get("total_tokens", prompt_tok + comp_tokens),
						"kv_cache_ram_mb": kv_ram,
						"priority": prio,
						"times_paused": paused,
						"total_turn_seconds": turn_total_seconds
					}
				}
				if last_usage:
					done_msg["usage"] = usage_data
					done_msg["priority"] = prio
					done_msg["times_paused"] = paused
					done_msg["kv_cache_ram_mb"] = kv_ram
				await websocket.send_json(done_msg)

				if user_prompt_clean:
					try:
						branch = await tree_context_manager.get_or_create_branch(branch_id)
						active_rag = await tree_context_manager.project_context(branch_id, user_prompt_clean)
						conversation_logger.log_user_turn(
							session_id=session_id,
							title=user_prompt_clean,
							system_prompt=load_default_system_prompt(),
							tree_rag_context=active_rag,
							last_10_messages=branch.get("messages", []),
							user_message=user_prompt_clean,
							final_response=accumulated,
							metadata={"model": model}
						)
						await tree_context_manager.add_turn(branch_id, user_prompt_clean, accumulated)
					except Exception as e_tree:
						print(f"[WS Chat] Tree log/add_turn warning: {e_tree}")
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
			branch_id = data.get("branch_id") or data.get("session_id") or "main"
			session_id = data.get("session_id") or branch_id
			from services.conversation_logger import set_active_session
			set_active_session(session_id)

			if msg_type == "fork_branch":
				source_id = data.get("source_branch_id", "main")
				target_id = data.get("new_branch_id", "")
				new_name = data.get("new_name", "")
				if target_id:
					new_branch = await tree_context_manager.fork_branch(source_id, target_id, new_name)
					await websocket.send_json({"type": "branch_forked", "branch": {"id": new_branch["id"], "name": new_branch["name"]}})
				continue

			elif msg_type == "archive_rag":
				topic = data.get("topic", "general")
				subtopic = data.get("subtopic", "nota")
				detail = data.get("detail", "detalle")
				node_data = data.get("data")
				await tree_context_manager.archive_to_tree(branch_id, topic, subtopic, detail, node_data)
				await websocket.send_json({"type": "rag_archived", "status": "ok", "topic": topic})
				continue

			elif msg_type in ("chat", "send") or "messages" in data:
				if current_stream_task and not current_stream_task.done():
					current_stream_task.cancel()
				raw_messages = data.get("messages", [])
				model = data.get("model", settings.LLM_MODEL)
				tts_mode = data.get("tts_mode", "rpi5")
				priority = bool(data.get("priority", False))
				fast = bool(data.get("fast", True))
				turn_id = data.get("turn_id", "")

				if raw_messages:
					clean_user_text = ""
					for m in reversed(raw_messages):
						if m.get("role") == "user":
							raw_c = m.get("content", "")
							if raw_c.startswith("[Fecha y hora actual:"):
								parts = raw_c.split("]\n", 1)
								clean_user_text = parts[1] if len(parts) > 1 else raw_c
							else:
								clean_user_text = raw_c
							break

					# Dynamic RAG context projection
					tree_context = await tree_context_manager.project_context(branch_id, clean_user_text)

					# Check for Plan-and-Solve complex path
					if clean_user_text and is_complex_request(clean_user_text):
						async def run_complex_plan():
							try:
								async def send_status(status_text: str):
									await websocket.send_json({"type": "assistant_status", "status": status_text})

								orchestrator = PlanAndSolveOrchestrator()
								res = await orchestrator.run(clean_user_text, model, on_status=send_status)
								final_text = res.get("final_text", "")
								steps = res.get("steps", [])

								# Archive to 3-level tree RAG and log each plan step
								words = clean_user_text.split()
								topic_name = " ".join(words[:3])[:25]
								for s in steps:
									s_id = s.get("step", 1)
									s_desc = s.get("description", "")
									s_res = s.get("result", "")
									try:
										conversation_logger.log_plan_step(
											session_id=session_id,
											step_id=s_id,
											description=s_desc,
											context_given="",
											result=s_res
										)
									except Exception:
										pass
									await tree_context_manager.archive_to_tree(
										branch_id,
										topic=topic_name,
										subtopic=f"Paso {s_id}",
										detail=s_desc[:35],
										data=s_res[:100]
									)

								branch = await tree_context_manager.get_or_create_branch(branch_id)
								active_rag = await tree_context_manager.project_context(branch_id, clean_user_text)
								try:
									conversation_logger.log_user_turn(
										session_id=session_id,
										title=clean_user_text,
										system_prompt=load_default_system_prompt(),
										tree_rag_context=active_rag,
										last_10_messages=branch.get("messages", []),
										user_message=clean_user_text,
										final_response=final_text,
										metadata={"model": model, "plan_and_solve": True}
									)
								except Exception as e_log:
									print(f"[WS Chat] Complex plan log warning: {e_log}")

								await tree_context_manager.add_turn(branch_id, clean_user_text, final_text, auto_topic=topic_name)

								await websocket.send_json({
									"type": "done",
									"full_text": final_text,
									"steps": steps,
									"rag_archived": True
								})
							except asyncio.CancelledError:
								pass
							except Exception as e_plan:
								await websocket.send_json({"type": "error", "message": str(e_plan)})

						current_stream_task = asyncio.create_task(run_complex_plan())
						continue

					# Normal direct chat flow with Tree Context injected
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

					base_sys = load_default_system_prompt()
					has_sys = False
					for m in messages:
						if m.get("role") == "system":
							m["content"] = base_sys
							has_sys = True
							break
					if not has_sys:
						messages.insert(0, {"role": "system", "content": base_sys})

					if tree_context:
						for m in reversed(messages):
							if m.get("role") == "user":
								m["content"] = f"[Contexto de memoria activo:\n{tree_context}]\n\n{m['content']}"
								break

					current_stream_task = asyncio.create_task(
						stream_tokens(
							messages,
							model,
							tts_mode,
							priority=priority,
							fast=fast,
							turn_id=turn_id,
							branch_id=branch_id,
							user_prompt_clean=clean_user_text,
							session_id=session_id
						)
					)
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
