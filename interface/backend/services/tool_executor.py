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

async def execute_tool(name: str, arguments: Dict[str, Any] | str | None) -> str:
	if isinstance(arguments, str):
		try:
			arguments = json.loads(arguments)
		except Exception:
			arguments = {}
	elif not isinstance(arguments, dict):
		arguments = {}

	handler = TOOL_REGISTRY.get(name)
	if not handler:
		return f"Error: Herramienta desconocida '{name}'."

	return await handler(arguments)
