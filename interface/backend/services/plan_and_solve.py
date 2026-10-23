import re
import json
import asyncio
from typing import Optional, Callable, Awaitable, Any
from config import settings, load_default_system_prompt
from services.llm_client import LLMClient
from services.silence_killer import format_step_completion_status, format_silence_killer_status

llm_service = LLMClient()

def is_complex_request(user_text: str) -> bool:
	text = user_text.strip().lower()
	if len(text.split()) < 6:
		return False

	# Planning and multi-intent triggers
	complex_patterns = [
		r"\b(planifica|organiza|diseña un plan|crea un itinerario|elabora un plan)\b",
		r"\b(busca|investiga|mira|averigua|revisa|encuentra)\b.*\b(y|ademas|luego|despues|tambien)\b.*\b(busca|mira|reserva|organiza|compara|averigua|analiza|revisa|comprueba)\b",
		r"\b(compara|analiza opciones)\b.*\b(y dime|para decidir|y elige|y selecciona)\b",
		r"\b(primero|paso a paso)\b.*\b(despues|luego|finalmente)\b"
	]
	for pat in complex_patterns:
		if re.search(pat, text, re.IGNORECASE):
			return True

	return False

class PlanAndSolveOrchestrator:
	def __init__(self, execution_mode: str = settings.AGENT_EXECUTION_MODE):
		self.execution_mode = execution_mode or "sequential"

	async def decompose_plan(self, user_query: str, model: str) -> list[dict]:
		prompt = (
			"Eres un planificador experto. Desglosa la siguiente petición del usuario en una lista de 2 a 4 pasos concisos.\n"
			"Devuelve EXCLUSIVAMENTE un JSON array con objetos que tengan los campos: 'id' (int), 'description' (string conciso de la tarea), y 'target_tool' (opcional: 'search_web', 'delegate_to_researcher', 'none').\n"
			f"Petición: {user_query}\n\nJSON:"
		)
		res = await llm_service.chat(
			messages=[{"role": "user", "content": prompt}],
			model=model,
			priority=True,
			fast=True,
			temperature=0.1
		)
		content = res.get("message", {}).get("content", "").strip()

		# Extract JSON array
		match = re.search(r"\[\s*\{.*\}\s*\]", content, re.DOTALL)
		if match:
			try:
				return json.loads(match.group(0))
			except Exception:
				pass

		# Fallback plan
		return [
			{"id": 1, "description": f"Investigar datos y opciones para: {user_query}", "target_tool": "search_web"},
			{"id": 2, "description": "Consolidar información y estructurar recomendaciones", "target_tool": "none"}
		]

	async def execute_task(
		self,
		task: dict,
		context_data: dict[int, str],
		model: str,
		on_status: Optional[Callable[[str], Awaitable[None]]] = None
	) -> str:
		task_id = task.get("id", 1)
		desc = task.get("description", "")

		# Kill silence with immediate feedback
		if on_status:
			await on_status(f"Iniciando tarea {task_id}: {desc[:40]}...")

		# Build clean context with only required dependencies
		task_prompt = (
			"Eres un sub-agente especializado ejecutando un paso concreto dentro de un plan mayor.\n"
			"Realiza la siguiente tarea de forma exhaustiva, preservando nombres, datos numéricos y detalles exactos.\n\n"
		)
		if context_data:
			task_prompt += "Datos obtenidos en pasos previos:\n"
			for prev_id, prev_res in context_data.items():
				task_prompt += f"- Paso {prev_id}: {prev_res}\n"
			task_prompt += "\n"

		task_prompt += f"Tarea asignada (Paso {task_id}): {desc}\n\nInforme detallado de este paso:"

		# Execute in clean context
		res = await llm_service.chat(
			messages=[{"role": "user", "content": task_prompt}],
			model=model,
			priority=True,
			fast=True,
			temperature=0.2
		)
		return res.get("message", {}).get("content", "").strip()

	async def run(
		self,
		user_query: str,
		model: str,
		on_status: Optional[Callable[[str], Awaitable[None]]] = None
	) -> dict[str, Any]:
		# 1. Kill silence immediately on plan detection (< 10 words)
		if on_status:
			await on_status("Analizando solicitud y diseñando plan de investigación...")

		# 2. Decompose into structured steps
		tasks = await self.decompose_plan(user_query, model)
		total_steps = len(tasks)
		step_results: dict[int, str] = {}
		steps_metadata: list[dict] = []

		# 3. Execute steps with clean cache per task
		if self.execution_mode == "parallel":
			# Concurrency mode for high-end servers
			async def run_single(t: dict):
				res = await self.execute_task(t, {}, model, on_status=on_status)
				step_results[t["id"]] = res
				if on_status:
					await on_status(format_step_completion_status(t["id"], total_steps, t.get("description", "")))

			await asyncio.gather(*(run_single(t) for t in tasks))
		else:
			# Strict sequential mode for Raspberry Pi 5
			for t in tasks:
				tid = t["id"]
				res = await self.execute_task(t, step_results, model, on_status=on_status)
				step_results[tid] = res
				steps_metadata.append({
					"step": tid,
					"description": t.get("description", ""),
					"result": res
				})
				if on_status:
					await on_status(format_step_completion_status(tid, total_steps, t.get("description", "")))

		# 4. Final synthesis: exhaustive structured report preserving all key facts
		if on_status:
			await on_status("Redactando informe final estructurado...")

		synthesis_prompt = (
			f"{load_default_system_prompt()}\n\n"
			"INSTRUCCIÓN CRÍTICA DE SÍNTESIS:\n"
			"Genera un informe estructurado y exhaustivo que responda de forma completa a la consulta original del usuario.\n"
			"PROHIBIDO omitir datos concretos (fechas, horas, nombres de lugares, precios, platos, personas o condiciones climáticas).\n"
			"Presenta la información organizada con títulos y viñetas claras.\n\n"
			f"Consulta del usuario: {user_query}\n\n"
			"Resultados obtenidos en cada paso de la investigación:\n"
		)
		for tid, r_text in step_results.items():
			synthesis_prompt += f"--- Resultado Paso {tid} ---\n{r_text}\n\n"
		synthesis_prompt += "Respuesta final exhaustiva para el usuario:"

		final_res = await llm_service.chat(
			messages=[{"role": "user", "content": synthesis_prompt}],
			model=model,
			priority=True,
			fast=True,
			temperature=0.3
		)
		final_text = final_res.get("message", {}).get("content", "").strip()

		return {
			"final_text": final_text,
			"steps": steps_metadata,
			"tasks_count": total_steps
		}
