import json
from typing import Dict, Any, List
from config import settings
from services.llm_client import LLMClient

llm_service = LLMClient()

class SubAgent:
	def __init__(self, name: str, description: str, system_prompt: str, model: str | None = None, temperature: float = 0.3):
		self.name = name
		self.description = description
		self.system_prompt = system_prompt
		self.model = model or settings.LLM_MODEL
		self.temperature = temperature

	async def run(self, task: str, context: str = "") -> str:
		messages = [{"role": "system", "content": self.system_prompt}]
		if context:
			messages.append({"role": "user", "content": f"Contexto previo:\n{context}\n\nTarea a resolver:\n{task}"})
		else:
			messages.append({"role": "user", "content": task})

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
		name="Investigador",
		description="Delega consultas complejas de análisis técnico, investigación y síntesis de datos factuales.",
		system_prompt=_RESEARCHER_PROMPT,
		temperature=0.2
	),
	"coder": SubAgent(
		name="Programador",
		description="Delega tareas de desarrollo de software, algoritmos, depuración y arquitectura de código.",
		system_prompt=_CODER_PROMPT,
		temperature=0.1
	),
	"writer": SubAgent(
		name="Redactor",
		description="Delega redacción de correos, síntesis ejecutivas, comunicados formales o mejora de estilo.",
		system_prompt=_WRITER_PROMPT,
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
