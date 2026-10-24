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
from services.tool_executor import execute_tool
from services.adapters import get_adapter
from config import ensure_system_prompt, settings, load_default_system_prompt
from services.tree_context_manager import TreeContextManager
from services.plan_and_solve import is_complex_request, PlanAndSolveOrchestrator
from services.conversation_logger import conversation_logger, set_active_session

tree_context_manager = TreeContextManager()

class ChatRequest(BaseModel):
	messages: list[dict]
	model: str | None = None
	priority: bool | None = False
	fast: bool | None = True
	max_tokens: int | None = None
	temperature: float | None = None
	branch_id: str | None = "main"
	session_id: str | None = None

class TTSRequest(BaseModel):
	text: str
	voice: str | None = None

from services.tool_definitions import NATIVE_TOOLS
import json

@router.post("/chat")
async def handle_chat(req: ChatRequest):
	try:
		branch_id = req.branch_id or "main"
		target_session_id = req.session_id or branch_id
		set_active_session(target_session_id)
		clean_user_text = ""
		for m in reversed(req.messages):
			if m.get("role") == "user":
				raw_c = m.get("content", "")
				if raw_c.startswith("[Fecha y hora actual:"):
					parts = raw_c.split("]\n", 1)
					clean_user_text = parts[1] if len(parts) > 1 else raw_c
				else:
					clean_user_text = raw_c
				break

		selected_model = req.model or settings.LLM_MODEL or "gemma4:e2b"

		# Check for Plan-and-Solve complex path
		if clean_user_text and is_complex_request(clean_user_text):
			orchestrator = PlanAndSolveOrchestrator()
			res = await orchestrator.run(clean_user_text, selected_model)
			final_text = res.get("final_text", "")
			steps = res.get("steps", [])

			# Archive to 3-level tree RAG
			words = clean_user_text.split()
			topic_name = " ".join(words[:3])[:25]
			for s in steps:
				s_id = s.get("step", 1)
				s_desc = s.get("description", "")
				s_res = s.get("result", "")
				try:
					conversation_logger.log_plan_step(
						session_id=target_session_id,
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
					session_id=target_session_id,
					title=clean_user_text,
					system_prompt=load_default_system_prompt(),
					tree_rag_context=active_rag,
					last_10_messages=branch.get("messages", []),
					user_message=clean_user_text,
					final_response=final_text,
					metadata={"model": selected_model, "plan_and_solve": True}
				)
			except Exception as e_log:
				print(f"[REST Chat] Log warning: {e_log}")

			await tree_context_manager.add_turn(branch_id, clean_user_text, final_text, auto_topic=topic_name)

			return {
				"message": {"role": "assistant", "content": final_text},
				"steps": steps,
				"rag_archived": True,
				"tools_used": []
			}

		# Dynamic RAG context projection
		tree_context = await tree_context_manager.project_context(branch_id, clean_user_text)

		messages = []
		for m in req.messages:
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

		from services.agent_manager import load_agent_profile
		from services.tool_definitions import get_tools_for_agent
		main_profile = load_agent_profile("system_prompt")
		profile_tools = get_tools_for_agent(main_profile)
		target_temperature = req.temperature if req.temperature is not None else main_profile.temperature
		call_tracker: dict[str, int] = {}

		# Native OpenAI Tool Calling Loop (up to 3 steps)
		selected_model = req.model or settings.LLM_MODEL or "gemma4:e2b"
		executed_tools = []
		debug_events = []
		for step in range(3):
			if not settings.HIDE_BACKGROUND:
				debug_events.append({"stage": "turn_start", "step": step, "model": selected_model, "tools_enabled": step == 0})
			res = await llm_service.chat(
				messages,
				model=selected_model,
				tools=profile_tools if (step == 0 and profile_tools) else None,
				priority=bool(req.priority),
				fast=bool(req.fast if req.fast is not None else True),
				max_tokens=req.max_tokens,
				temperature=target_temperature,
			)
			adapter = get_adapter(selected_model)
			msg = res.get("message", {})
			tool_calls = adapter.extract_tool_calls(
				native_tool_calls=msg.get("tool_calls"),
				text_content=msg.get("content")
			)

			if tool_calls:
				if msg.get("tool_calls"):
					messages.append(msg)
				for tc in tool_calls:
					print(f"[REST Chat] Tool call detected ({adapter.name}): {tc.name} args={tc.args}")
					if not settings.HIDE_BACKGROUND:
						debug_events.append({"stage": "tool_calling", "tool": tc.name, "args": tc.args, "step": step})
					tool_result = await execute_tool(
						tc.name,
						tc.args,
						caller_profile=main_profile,
						call_tracker=call_tracker
					)
					executed_tools.append({"tool": tc.name, "args": tc.args})
					try:
						conversation_logger.log_tool_call(
							session_id=target_session_id,
							tool_name=tc.name,
							args=tc.args,
							result=tool_result
						)
					except Exception:
						pass
					if not settings.HIDE_BACKGROUND:
						debug_events.append({"stage": "tool_result", "tool": tc.name, "result": tool_result})
					messages.extend(adapter.format_tool_response(tc, tool_result))
				continue

			res["tools_used"] = executed_tools
			if not settings.HIDE_BACKGROUND:
				res["debug_events"] = debug_events
			if clean_user_text:
				assistant_text = res.get("message", {}).get("content", "")
				if assistant_text:
					try:
						branch = await tree_context_manager.get_or_create_branch(branch_id)
						active_rag = await tree_context_manager.project_context(branch_id, clean_user_text)
						conversation_logger.log_user_turn(
							session_id=target_session_id,
							title=clean_user_text,
							system_prompt=load_default_system_prompt(),
							tree_rag_context=active_rag,
							last_10_messages=branch.get("messages", []),
							user_message=clean_user_text,
							final_response=assistant_text,
							metadata={"model": selected_model}
						)
					except Exception as e_log:
						print(f"[REST Chat] User turn log warning: {e_log}")
					await tree_context_manager.add_turn(branch_id, clean_user_text, assistant_text)
			return res

		res["tools_used"] = executed_tools
		if not settings.HIDE_BACKGROUND:
			res["debug_events"] = debug_events
		if clean_user_text:
			assistant_text = res.get("message", {}).get("content", "")
			if assistant_text:
				try:
					branch = await tree_context_manager.get_or_create_branch(branch_id)
					active_rag = await tree_context_manager.project_context(branch_id, clean_user_text)
					conversation_logger.log_user_turn(
						session_id=target_session_id,
						title=clean_user_text,
						system_prompt=load_default_system_prompt(),
						tree_rag_context=active_rag,
						last_10_messages=branch.get("messages", []),
						user_message=clean_user_text,
						final_response=assistant_text,
						metadata={"model": selected_model}
					)
				except Exception as e_log:
					print(f"[REST Chat] User turn log warning: {e_log}")
				await tree_context_manager.add_turn(branch_id, clean_user_text, assistant_text)
		return res
	except Exception as e:
		import traceback
		traceback.print_exc()
		raise HTTPException(status_code=502, detail=f"LLM proxy error: {repr(e)}")

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
