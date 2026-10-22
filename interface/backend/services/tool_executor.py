import json
from typing import Dict, Any, Callable, Awaitable
from services.web_tools_client import WebToolsClient

web_tools_client = WebToolsClient()

async def _search_web(args: Dict[str, Any]) -> str:
	query = str(args.get("query", "")).strip()
	if not query:
		return "Error: Consulta vacía para search_web."

	try:
		data = await web_tools_client.search(query, max_results=3)
		results = data.get("results") or []
		if not results:
			return f"No se encontraron resultados para: {query}"

		lines = [
			f"- [{r.get('title', 'Sin título')}]({r.get('url', '')}): {str(r.get('snippet', '')).strip()[:200]}"
			for r in results[:3] if isinstance(r, dict)
		]
		return f"Resultados de búsqueda web para '{query}':\n" + "\n".join(lines)
	except Exception as e:
		return f"Error al ejecutar búsqueda web: {str(e)}"

async def _read_url(args: Dict[str, Any]) -> str:
	url = str(args.get("url", "")).strip()
	if not url:
		return "Error: URL vacía para read_url."

	try:
		data = await web_tools_client.read_url(url)
		title = data.get("title", url)
		markdown = data.get("markdown", "")
		content = markdown if markdown else "Página vacía o sin contenido legible."
		return f"Contenido de '{title}' ({url}):\n\n{content}"
	except Exception as e:
		return f"Error al leer URL: {str(e)}"

async def _read_pdf(args: Dict[str, Any]) -> str:
	url = str(args.get("url", "")).strip()
	if not url:
		return "Error: URL vacía para read_pdf."

	try:
		data = await web_tools_client.parse_pdf(pdf_url=url)
		filename = data.get("filename", url)
		pages = data.get("pages", 1)
		markdown = data.get("markdown", "")
		content = markdown if markdown else "Documento PDF vacío."
		return f"Contenido de PDF '{filename}' ({pages} páginas):\n\n{content}"
	except Exception as e:
		return f"Error al procesar PDF: {str(e)}"

TOOL_REGISTRY: Dict[str, Callable[[Dict[str, Any]], Awaitable[str]]] = {
	"search_web": _search_web,
	"read_url": _read_url,
	"read_pdf": _read_pdf,
}

from services.sub_agents import SUB_AGENTS

async def _delegate_sub_agent(sub_agent_key: str, args: Dict[str, Any], on_metric: Any = None) -> str:
	agent = SUB_AGENTS.get(sub_agent_key)
	if not agent:
		return f"Error: Sub-agente '{sub_agent_key}' no encontrado."
	task = str(args.get("task", "")).strip()
	context = str(args.get("context", "")).strip()
	if not task:
		return f"Error: Tarea vacía para sub-agente '{sub_agent_key}'."
	return await agent.run(task=task, context=context, on_metric=on_metric)

for _agent_key in SUB_AGENTS.keys():
	TOOL_REGISTRY[f"delegate_to_{_agent_key}"] = (
		lambda k: (lambda args, on_m=None: _delegate_sub_agent(k, args, on_metric=on_m))
	)(_agent_key)

async def execute_tool(name: str, arguments: Dict[str, Any] | str | None, on_metric: Any = None) -> str:
	if isinstance(arguments, str):
		try:
			arguments = json.loads(arguments)
		except Exception:
			arguments = {}
	elif not isinstance(arguments, dict):
		arguments = {}

	handler = TOOL_REGISTRY.get(name)
	if not handler and name.startswith("delegate_to_"):
		sub_agent_key = name[len("delegate_to_"):]
		if sub_agent_key in SUB_AGENTS:
			return await _delegate_sub_agent(sub_agent_key, arguments, on_metric=on_metric)

	if not handler:
		return f"Error: Herramienta desconocida '{name}'."

	if name.startswith("delegate_to_"):
		return await handler(arguments, on_m=on_metric)
	return await handler(arguments)
