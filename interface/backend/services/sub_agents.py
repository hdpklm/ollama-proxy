import json
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
		import time
		t_start = time.time()
		snapshot_id = f"caller_before_{self.key}"
		# Preserve active caller KV context in RAM before running sub-agent
		await llm_service.save_context_snapshot(snapshot_id=snapshot_id, priority=False)

		model_info = await llm_service.get_model_info(self.model)

		prompt = load_prompt(self.key, fallback=self.system_prompt)
		messages = [{"role": "system", "content": prompt}]
		if context:
			messages.append({"role": "user", "content": f"Contexto previo:\n{context}\n\nTarea a resolver:\n{task}"})
		else:
			messages.append({"role": "user", "content": task})

		res: Dict[str, Any] = {}
		restore_info: Dict[str, Any] = {}
		try:
			res = await llm_service.chat(
				messages=messages,
				model=self.model,
				temperature=self.temperature,
				priority=False,
				fast=True
			)
			content = res.get("message", {}).get("content") or res.get("response") or ""
			if not content:
				return f"[{self.name}] No se obtuvo respuesta del sub-agente."
			return f"[{self.name}]:\n{content}"
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
