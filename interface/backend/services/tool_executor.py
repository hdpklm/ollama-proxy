import json
import re
from typing import Tuple, Dict, Any
from services.web_tools_client import WebToolsClient

TOOL_CALL_REGEX = re.compile(r'<tool_call>\s*({.*?})\s*</tool_call>', re.DOTALL)

web_tools_client = WebToolsClient()

def extract_tool_call(text: str) -> Tuple[str | None, Dict[str, Any] | None, str | None]:
	match = TOOL_CALL_REGEX.search(text)
	if not match:
		return None, None, None

	raw_json = match.group(1).strip()
	try:
		data = json.loads(raw_json)
		name = data.get("name")
		args = data.get("arguments", {})
		return name, args, match.group(0)
	except Exception:
		return None, None, match.group(0)

async def execute_tool(name: str, arguments: dict) -> str:
	if name == "search_web":
		query = str(arguments.get("query", "")).strip()
		if not query:
			return "Error: Consulta vacía para search_web."
		try:
			data = await web_tools_client.search(query, max_results=4)
			results = data.get("results", [])
			if not results:
				return f"No se encontraron resultados para: {query}"
			lines = [f"- [{r.get('title', 'Sin título')}]({r.get('url', '')}): {r.get('snippet', '')}" for r in results]
			return f"Resultados de búsqueda web para '{query}':\n" + "\n".join(lines)
		except Exception as e:
			return f"Error al ejecutar búsqueda web: {str(e)}"

	elif name == "read_url":
		url = str(arguments.get("url", "")).strip()
		if not url:
			return "Error: URL vacía para read_url."
		try:
			data = await web_tools_client.read_url(url)
			title = data.get("title", url)
			md_text = data.get("markdown", "")
			preview = md_text[:3500] if md_text else "Página vacía o sin contenido legible."
			return f"Contenido de la página '{title}' ({url}):\n\n{preview}"
		except Exception as e:
			return f"Error al leer URL '{url}': {str(e)}"

	elif name == "read_pdf":
		url = str(arguments.get("url", "")).strip()
		if not url:
			return "Error: URL vacía para read_pdf."
		try:
			data = await web_tools_client.parse_pdf(pdf_url=url)
			filename = data.get("filename", url)
			pages = data.get("pages", 1)
			md_text = data.get("markdown", "")
			preview = md_text[:3500] if md_text else "Documento PDF vacío."
			return f"Contenido de PDF '{filename}' ({pages} páginas):\n\n{preview}"
		except Exception as e:
			return f"Error al procesar PDF '{url}': {str(e)}"

	return f"Error: Herramienta desconocida '{name}'."
