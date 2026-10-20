import json
import re
from typing import Tuple, Dict, Any
from services.web_tools_client import WebToolsClient

TOOL_CALL_REGEX = re.compile(r'<tool_call>\s*({.*?})\s*</tool_call>', re.DOTALL)

web_tools_client = WebToolsClient()

def extract_tool_call(text: str) -> Tuple[str | None, Any, str | None]:
	match = TOOL_CALL_REGEX.search(text)
	if not match:
		return None, None, None

	raw_json = match.group(1).strip()
	try:
		data = json.loads(raw_json)
		if not isinstance(data, dict):
			return None, None, match.group(0)

		name = data.get("name")
		args = data.get("arguments")
		if args is None:
			# If arguments were omitted or placed at the root level of the JSON
			args = {k: v for k, v in data.items() if k != "name"}
		return name, args, match.group(0)
	except Exception:
		return None, None, match.group(0)

def _extract_query(args: Any) -> str:
	if isinstance(args, str):
		return args.strip()
	if isinstance(args, dict):
		for key in ("query", "q", "search_query", "text", "location", "ciudad", "lugar", "term", "prompt"):
			if key in args and args[key]:
				return str(args[key]).strip()
		if len(args) == 1:
			return str(list(args.values())[0]).strip()
	return ""

def _extract_url(args: Any) -> str:
	if isinstance(args, str):
		return args.strip()
	if isinstance(args, dict):
		for key in ("url", "link", "target_url", "uri", "path"):
			if key in args and args[key]:
				return str(args[key]).strip()
		if len(args) == 1:
			return str(list(args.values())[0]).strip()
	return ""

async def execute_tool(name: str, arguments: Any) -> str:
	if name == "search_web":
		query = _extract_query(arguments)
		if not query:
			return "Error: Consulta vacía para search_web."
		try:
			data = await web_tools_client.search(query, max_results=4)
			if isinstance(data, dict):
				results = data.get("results", [])
			elif isinstance(data, list):
				results = data
			else:
				results = []

			if not results:
				return f"No se encontraron resultados para: {query}"
			lines = [
				f"- [{r.get('title', 'Sin título')}]({r.get('url', '')}): {r.get('snippet', '')}"
				for r in results if isinstance(r, dict)
			]
			if not lines:
				return f"No se obtuvieron detalles para: {query}"
			return f"Resultados de búsqueda web para '{query}':\n" + "\n".join(lines)
		except Exception as e:
			return f"Error al ejecutar búsqueda web ('{query}'): {str(e)}"

	elif name == "read_url":
		url = _extract_url(arguments)
		if not url:
			return "Error: URL vacía para read_url."
		try:
			data = await web_tools_client.read_url(url)
			if isinstance(data, dict):
				title = data.get("title", url)
				md_text = data.get("markdown", "")
			else:
				title = url
				md_text = str(data)
			preview = md_text[:3500] if md_text else "Página vacía o sin contenido legible."
			return f"Contenido de la página '{title}' ({url}):\n\n{preview}"
		except Exception as e:
			return f"Error al leer URL '{url}': {str(e)}"

	elif name == "read_pdf":
		url = _extract_url(arguments)
		if not url:
			return "Error: URL vacía para read_pdf."
		try:
			data = await web_tools_client.parse_pdf(pdf_url=url)
			if isinstance(data, dict):
				filename = data.get("filename", url)
				pages = data.get("pages", 1)
				md_text = data.get("markdown", "")
			else:
				filename = url
				pages = 1
				md_text = str(data)
			preview = md_text[:3500] if md_text else "Documento PDF vacío."
			return f"Contenido de PDF '{filename}' ({pages} páginas):\n\n{preview}"
		except Exception as e:
			return f"Error al procesar PDF '{url}': {str(e)}"

	return f"Error: Herramienta desconocida '{name}'."
