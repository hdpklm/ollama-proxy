from typing import Dict, Any
from services.web_tools_client import WebToolsClient

web_tools_client = WebToolsClient()

async def search_web(args: Dict[str, Any]) -> str:
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

async def read_url(args: Dict[str, Any]) -> str:
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

async def read_pdf(args: Dict[str, Any]) -> str:
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

TOOLS: Dict[str, dict] = {
	"search_web": {
		"schema": {
			"type": "function",
			"function": {
				"name": "search_web",
				"description": "Busca en internet información actualizada sobre eventos, noticias, meteorología o datos recientes.",
				"parameters": {
					"type": "object",
					"properties": {
						"query": {
							"type": "string",
							"description": "Texto exacto o término a buscar en la web."
						}
					},
					"required": ["query"]
				}
			}
		},
		"handler": search_web
	},
	"read_url": {
		"schema": {
			"type": "function",
			"function": {
				"name": "read_url",
				"description": "Descarga y extrae el texto principal en formato markdown de una página web.",
				"parameters": {
					"type": "object",
					"properties": {
						"url": {
							"type": "string",
							"description": "URL completa http o https de la página web a leer."
						}
					},
					"required": ["url"]
				}
			}
		},
		"handler": read_url
	},
	"read_pdf": {
		"schema": {
			"type": "function",
			"function": {
				"name": "read_pdf",
				"description": "Descarga y extrae el contenido de texto de un archivo PDF ubicado en una URL.",
				"parameters": {
					"type": "object",
					"properties": {
						"url": {
							"type": "string",
							"description": "URL completa del documento PDF a procesar."
						}
					},
					"required": ["url"]
				}
			}
		},
		"handler": read_pdf
	}
}
