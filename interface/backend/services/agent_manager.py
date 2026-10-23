import os
import yaml
import copy
from typing import Dict, Any, List, Tuple

class AgentProfile:
	def __init__(self, key: str, metadata: Dict[str, Any], raw_body: str):
		self.key = key
		self.name = metadata.get("name", key.capitalize())
		self.role = metadata.get("role", key)
		self.temperature = float(metadata.get("temperature", 0.3))
		self.tools_config = metadata.get("tools") or {}
		self.raw_body = raw_body.strip()

	def get_effective_prompt(self) -> str:
		if not self.tools_config:
			return self.raw_body

		guidelines = ["\n\n## Herramientas Asignadas y Directrices de Uso"]
		guidelines.append("Dispones ÚNICAMENTE de las siguientes herramientas autorizadas para tu rol:")

		for tool_name, cfg in self.tools_config.items():
			purpose = cfg.get("purpose", "")
			max_calls = cfg.get("max_calls")
			rules = cfg.get("rules", [])

			tool_block = [f"- `{tool_name}`:"]
			if purpose:
				tool_block.append(f"  - **Propósito**: {purpose}")
			if rules:
				tool_block.append("  - **Reglas y Restricciones**:")
				for r in rules:
					tool_block.append(f"    * {r}")
			if max_calls is not None:
				tool_block.append(f"  - **Límite por turno**: Máximo {max_calls} llamada(s). Prohibido exceder este límite.")

			guidelines.append("\n".join(tool_block))

		guidelines.append("\n**IMPORTANTE**: No intentes invocar ninguna herramienta ajena a esta lista ni superar los límites fijados.")
		return self.raw_body + "\n" + "\n".join(guidelines)

	def can_execute_tool(self, tool_name: str, current_call_count: int) -> Tuple[bool, str]:
		if tool_name not in self.tools_config:
			return False, f"Herramienta '{tool_name}' no autorizada para tu rol de '{self.name}'."

		tool_cfg = self.tools_config.get(tool_name) or {}
		max_calls = tool_cfg.get("max_calls")
		if max_calls is not None and current_call_count >= max_calls:
			return False, (
				f"Límite alcanzado: Has alcanzado el límite máximo de {max_calls} llamadas "
				f"para la herramienta '{tool_name}' en este turno. Procede a responder al usuario "
				f"con la información ya recopilada."
			)

		return True, ""


def parse_frontmatter(content: str) -> Tuple[Dict[str, Any], str]:
	trimmed = content.strip()
	if not trimmed.startswith("---"):
		return {}, content

	parts = trimmed.split("---", 2)
	if len(parts) < 3:
		return {}, content

	yaml_text = parts[1]
	body_text = parts[2]

	try:
		metadata = yaml.safe_load(yaml_text) or {}
	except Exception as e:
		print(f"[AgentManager] Warning: Failed to parse YAML frontmatter: {e}")
		metadata = {}

	return metadata, body_text.strip()


def get_prompts_directory() -> str:
	from config import get_prompts_dir
	return get_prompts_dir()


def load_agent_profile(agent_key: str) -> AgentProfile:
	prompts_dir = get_prompts_directory()
	file_candidates = [
		os.path.join(prompts_dir, f"{agent_key}.md"),
		os.path.join(prompts_dir, f"{agent_key}.txt"),
		os.path.join(prompts_dir, agent_key)
	]
	if agent_key in ("main", "system", "system_prompt", "main_agent"):
		file_candidates.insert(0, os.path.join(prompts_dir, "system_prompt.md"))

	raw_content = ""
	for path in file_candidates:
		if os.path.exists(path) and os.path.isfile(path):
			try:
				with open(path, "r", encoding="utf-8") as f:
					raw_content = f.read().strip()
					if raw_content:
						break
			except Exception:
				pass

	if not raw_content:
		raw_content = f"Eres el asistente {agent_key}."

	metadata, body = parse_frontmatter(raw_content)
	return AgentProfile(agent_key, metadata, body)
