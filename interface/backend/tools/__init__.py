import copy
import json
from typing import Dict, Any, List

from tools.web import TOOLS as WEB_TOOLS
from tools.delegation import TOOLS as DELEGATION_TOOLS

TOOL_REGISTRY: Dict[str, dict] = {}
TOOL_REGISTRY.update(WEB_TOOLS)
TOOL_REGISTRY.update(DELEGATION_TOOLS)

def get_tool_entry(name: str) -> dict | None:
	return TOOL_REGISTRY.get(name)

def get_master_tool_schemas() -> Dict[str, dict]:
	return {name: copy.deepcopy(entry["schema"]) for name, entry in TOOL_REGISTRY.items()}

def get_tools_for_agent(profile_or_key: Any) -> List[dict]:
	from services.agent_manager import AgentProfile, load_agent_profile
	if isinstance(profile_or_key, AgentProfile):
		profile = profile_or_key
	else:
		profile = load_agent_profile(str(profile_or_key))

	if not profile.tools_config:
		return []

	agent_tools = []
	for tool_name, tool_cfg in profile.tools_config.items():
		entry = TOOL_REGISTRY.get(tool_name)
		if entry:
			schema_copy = copy.deepcopy(entry["schema"])
			custom_purpose = tool_cfg.get("purpose")
			if custom_purpose:
				schema_copy["function"]["description"] = custom_purpose
			agent_tools.append(schema_copy)

	return agent_tools

async def execute_tool(
	name: str,
	arguments: Dict[str, Any] | str | None,
	on_metric: Any = None,
	caller_profile: Any = None,
	call_tracker: Dict[str, int] | None = None
) -> str:
	if isinstance(arguments, str):
		try:
			arguments = json.loads(arguments)
		except Exception:
			arguments = {}
	elif not isinstance(arguments, dict):
		arguments = {}

	# Guardrails & call limit enforcement per agent profile
	if caller_profile is not None:
		from services.agent_manager import AgentProfile, load_agent_profile
		if not isinstance(caller_profile, AgentProfile):
			caller_profile = load_agent_profile(str(caller_profile))

		current_count = call_tracker.get(name, 0) if call_tracker is not None else 0
		can_run, reason = caller_profile.can_execute_tool(name, current_count)
		if not can_run:
			print(f"[ToolExecutor] Guardrail blocked '{name}' for '{caller_profile.name}': {reason}")
			return f"Error: {reason}"

	entry = TOOL_REGISTRY.get(name)
	if not entry:
		return f"Error: Herramienta desconocida '{name}'."

	handler = entry.get("handler")
	if not handler or not callable(handler):
		return f"Error: Herramienta '{name}' no tiene un handler ejecutable asignado."

	try:
		if name.startswith("delegate_to_"):
			res = await handler(arguments, on_m=on_metric)
		else:
			res = await handler(arguments)

		if call_tracker is not None:
			call_tracker[name] = call_tracker.get(name, 0) + 1

		return res
	except Exception as e:
		return f"Error al ejecutar herramienta '{name}': {str(e)}"
