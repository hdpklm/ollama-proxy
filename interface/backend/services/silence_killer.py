import json
from typing import Any
from urllib.parse import urlparse

def format_silence_killer_status(tool_name: str, args: Any) -> str:
	parsed_args = args
	if isinstance(args, str):
		try:
			parsed_args = json.loads(args)
		except Exception:
			parsed_args = {"raw": args}
	if not isinstance(parsed_args, dict):
		parsed_args = {"value": str(parsed_args)}

	def truncate_words(text: str, max_words: int = 6) -> str:
		words = text.strip().split()
		if len(words) <= max_words:
			return text.strip()
		return " ".join(words[:max_words]) + "..."

	if tool_name in ("search_web", "web_search"):
		query = str(parsed_args.get("query") or parsed_args.get("q") or "").strip()
		if query:
			return f"Buscando en la web: {truncate_words(query, 5)}"
		return "Buscando información actualizada en la web..."

	if tool_name in ("read_url", "read_url_content", "fetch_url"):
		url = str(parsed_args.get("url") or "").strip()
		if url:
			try:
				domain = urlparse(url).netloc or url
				return f"Leyendo página: {truncate_words(domain, 4)}"
			except Exception:
				pass
		return "Leyendo contenido de la página web..."

	if tool_name in ("read_pdf", "parse_pdf"):
		filename = str(parsed_args.get("filename") or parsed_args.get("path") or "").strip()
		if filename:
			return f"Analizando documento PDF: {truncate_words(filename, 4)}"
		return "Analizando documento PDF..."

	if tool_name == "delegate_to_researcher":
		task = str(parsed_args.get("task") or parsed_args.get("query") or "").strip()
		if task:
			return f"Investigador analizando: {truncate_words(task, 5)}"
		return "Investigador analizando fuentes técnicas..."

	if tool_name == "delegate_to_coder":
		task = str(parsed_args.get("task") or parsed_args.get("code") or "").strip()
		if task:
			return f"Programador revisando: {truncate_words(task, 5)}"
		return "Programador diseñando solución técnica..."

	if tool_name == "delegate_to_writer":
		task = str(parsed_args.get("task") or parsed_args.get("topic") or "").strip()
		if task:
			return f"Redactor elaborando: {truncate_words(task, 5)}"
		return "Redactor sintetizando informe ejecutivo..."

	return f"Consultando herramienta {tool_name}..."

def format_step_completion_status(step_index: int, total_steps: int, label: str = "") -> str:
	if label:
		words = label.strip().split()
		summary = " ".join(words[:4])
		return f"Paso {step_index}/{total_steps} listo: {summary}."
	return f"Paso {step_index} de {total_steps} completado con éxito."
