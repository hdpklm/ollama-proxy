from typing import Dict, Any

async def _delegate_to_agent(agent_key: str, args: Dict[str, Any], on_metric: Any = None) -> str:
	from services.sub_agents import SUB_AGENTS
	agent = SUB_AGENTS.get(agent_key)
	if not agent:
		return f"Error: Sub-agente '{agent_key}' no encontrado."

	task = str(args.get("task", "")).strip()
	context = str(args.get("context", "")).strip()
	if not task:
		return f"Error: Tarea vacía para sub-agente '{agent_key}'."

	return await agent.run(task=task, context=context, on_metric=on_metric)

def _build_delegation_tool(agent_key: str, description: str):
	return {
		"schema": {
			"type": "function",
			"function": {
				"name": f"delegate_to_{agent_key}",
				"description": description,
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
		},
		"handler": lambda args, on_m=None, k=agent_key: _delegate_to_agent(k, args, on_metric=on_m)
	}

TOOLS: Dict[str, dict] = {
	"delegate_to_researcher": _build_delegation_tool(
		"researcher",
		"Delega consultas complejas de análisis técnico, investigación y síntesis de datos factuales."
	),
	"delegate_to_coder": _build_delegation_tool(
		"coder",
		"Delega tareas de desarrollo de software, algoritmos, depuración y arquitectura de código."
	),
	"delegate_to_writer": _build_delegation_tool(
		"writer",
		"Delega redacción de correos, síntesis ejecutivas, comunicados formales o mejora de estilo."
	)
}
