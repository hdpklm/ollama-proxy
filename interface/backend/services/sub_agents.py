import json
import time
from typing import Dict, Any, List
from config import settings, load_prompt
from services.llm_client import LLMClient

llm_service = LLMClient()

class SubAgent:
	def __init__(self, key: str, name: str, description: str, system_prompt: str, model: str | None = None, temperature: float = 0.3):
		self.key = key
		self.name = name
		self.description = description
		self.system_prompt = system_prompt
		self.model = model or settings.LLM_MODEL
		self.temperature = temperature
		self.last_metrics: Dict[str, Any] | None = None

	async def run(self, task: str, context: str = "", on_metric: Any = None) -> str:
		t_start = time.time()
		snapshot_id = f"caller_before_{self.key}"
		# Preserve active caller KV context in RAM before running sub-agent
		await llm_service.save_context_snapshot(snapshot_id=snapshot_id, priority=False)

		model_info = await llm_service.get_model_info(self.model)

		from services.agent_manager import load_agent_profile
		from services.tool_definitions import get_tools_for_agent
		from services.adapters import get_adapter
		from services.tool_executor import execute_tool

		profile = load_agent_profile(self.key)
		prompt = profile.get_effective_prompt() or self.system_prompt
		sub_agent_tools = get_tools_for_agent(profile)
		target_temperature = profile.temperature if profile.temperature is not None else self.temperature
		adapter = get_adapter(self.model)

		messages = [{"role": "system", "content": prompt}]
		if context:
			messages.append({"role": "user", "content": f"Contexto previo:\n{context}\n\nTarea a resolver:\n{task}"})
		else:
			messages.append({"role": "user", "content": task})

		res: Dict[str, Any] = {}
		restore_info: Dict[str, Any] = {}
		call_tracker: Dict[str, int] = {}
		executed_tools = []

		try:
			# Autonomous sub-agent tool execution loop (up to 3 steps)
			for step in range(3):
				active_tools = sub_agent_tools if (step == 0 and sub_agent_tools) else None
				res = await llm_service.chat(
					messages=messages,
					model=self.model,
					tools=active_tools,
					temperature=target_temperature,
					priority=False,
					fast=True
				)
				msg = res.get("message", {})
				tool_calls = adapter.extract_tool_calls(
					native_tool_calls=msg.get("tool_calls"),
					text_content=msg.get("content")
				)

				if tool_calls:
					if msg.get("tool_calls"):
						messages.append(msg)
					for tc in tool_calls:
						tool_result = await execute_tool(
							tc.name,
							tc.args,
							on_metric=on_metric,
							caller_profile=profile,
							call_tracker=call_tracker
						)
						executed_tools.append({"tool": tc.name, "args": tc.args})
						messages.extend(adapter.format_tool_response(tc, tool_result))
					continue

				# Content generated without further tool calls
				content = msg.get("content") or res.get("response") or ""
				final_output = f"[{self.name}]:\n{content}" if content else f"[{self.name}] No se obtuvo respuesta del sub-agente."
				try:
					from services.conversation_logger import conversation_logger, get_active_session
					target_session = get_active_session()
					conversation_logger.log_agent_turn(
						session_id=target_session,
						agent_name=self.key,
						prompt=prompt,
						response=final_output,
						is_cached=bool(model_info.get("in_memory", True)),
						cache_info=getattr(profile, "prompt_hash", "") or getattr(profile, "raw_hash", ""),
						metadata={"temperature": target_temperature}
					)
				except Exception:
					pass
				return final_output

			content = res.get("message", {}).get("content") or res.get("response") or ""
			final_output = f"[{self.name}]:\n{content}"
			try:
				from services.conversation_logger import conversation_logger, get_active_session
				target_session = get_active_session()
				conversation_logger.log_agent_turn(
					session_id=target_session,
					agent_name=self.key,
					prompt=prompt,
					response=final_output,
					is_cached=bool(model_info.get("in_memory", True)),
					cache_info=getattr(profile, "prompt_hash", "") or getattr(profile, "raw_hash", ""),
					metadata={"temperature": target_temperature}
				)
			except Exception:
				pass
			return final_output
		except Exception as e:
			return f"[{self.name}] Error de ejecución: {str(e)}"
		finally:
			# Restore caller KV context in RAM immediately so main agent can resume without re-evaluating
			restore_info = await llm_service.restore_context_snapshot(snapshot_id=snapshot_id, priority=False)
			total_duration = round(time.time() - t_start, 3)
			usage = res.get("usage", {})
			prompt_tokens = usage.get("prompt_tokens", 0)
			prompt_eval_seconds = usage.get("prompt_eval_seconds", 0.0)
			prompt_tps = usage.get("prompt_tokens_per_second") or usage.get("prompt_token_s", 0.0)
			completion_tokens = usage.get("completion_tokens", 0)
			generation_seconds = usage.get("generation_seconds", 0.0)
			generation_tps = usage.get("tokens_per_second") or usage.get("generate_token_s", 0.0)

			self.last_metrics = {
				"name": self.name,
				"model": self.model,
				"model_load_time_seconds": model_info.get("load_time_seconds", 0.0),
				"model_in_memory": model_info.get("in_memory", True),
				"duration_seconds": total_duration,
				"prompt_tokens": prompt_tokens,
				"prompt_eval_seconds": prompt_eval_seconds,
				"prompt_tps": prompt_tps,
				"completion_tokens": completion_tokens,
				"generation_seconds": generation_seconds,
				"generation_tps": generation_tps,
				"total_tokens": usage.get("total_tokens", prompt_tokens + completion_tokens),
				"kv_restore_time_seconds": restore_info.get("restore_time_seconds", 0.0),
				"kv_cache_ram_mb": restore_info.get("kv_cache_ram_mb") or res.get("kv_cache_ram_mb", 0.0)
			}

			if on_metric and callable(on_metric):
				try:
					await on_metric(self.last_metrics)
				except Exception:
					pass

# Predefined specialized sub-agents
_RESEARCHER_PROMPT = (
	"Eres un sub-agente especialista en investigación y análisis factual riguroso.\n"
	"Tu cometido es sintetizar información técnica, científica o documental con máxima precisión.\n"
	"Estructura tus hallazgos en puntos clave, resalta datos concretos y evita divagaciones."
)

_CODER_PROMPT = (
	"Eres un sub-agente ingeniero de software senior.\n"
	"Tu cometido es generar código limpio, seguro, eficiente y bien estructurado (siguiendo principios SOLID/SRP).\n"
	"Proporciona implementaciones funcionales y explicaciones concisas directamente enfocadas en la solución técnica."
)

_WRITER_PROMPT = (
	"Eres un sub-agente especialista en redacción ejecutiva y comunicación clara.\n"
	"Tu cometido es redactar correos, documentos, resúmenes o comunicados con un tono pulido, profesional y elocuente."
)

SUB_AGENTS: Dict[str, SubAgent] = {
	"researcher": SubAgent(
		key="researcher",
		name="Investigador",
		description="Delega consultas complejas de análisis técnico, investigación y síntesis de datos factuales.",
		system_prompt=load_prompt("researcher", fallback=_RESEARCHER_PROMPT),
		temperature=0.2
	),
	"coder": SubAgent(
		key="coder",
		name="Programador",
		description="Delega tareas de desarrollo de software, algoritmos, depuración y arquitectura de código.",
		system_prompt=load_prompt("coder", fallback=_CODER_PROMPT),
		temperature=0.1
	),
	"writer": SubAgent(
		key="writer",
		name="Redactor",
		description="Delega redacción de correos, síntesis ejecutivas, comunicados formales o mejora de estilo.",
		system_prompt=load_prompt("writer", fallback=_WRITER_PROMPT),
		temperature=0.6
	)
}

def get_sub_agent_definitions() -> List[dict]:
	definitions = []
	for key, agent in SUB_AGENTS.items():
		definitions.append({
			"type": "function",
			"function": {
				"name": f"delegate_to_{key}",
				"description": agent.description,
				"parameters": {
					"type": "object",
					"properties": {
						"task": {
							"type": "string",
							"description": "Instrucción o tarea específica que debe resolver este sub-agente."
						},
						"context": {
							"type": "string",
							"description": "Contexto adicional, datos o código relevante necesario para resolver la tarea."
						}
					},
					"required": ["task"]
				}
			}
		})
	return definitions
