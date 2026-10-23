from typing import List, Dict, Any
import copy

BASE_TOOL_SCHEMAS: Dict[str, dict] = {
	"search_web": {
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
	"read_url": {
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
	"read_pdf": {
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
	}
}

def get_master_tool_schemas() -> Dict[str, dict]:
	from services.sub_agents import get_sub_agent_definitions
	schemas = copy.deepcopy(BASE_TOOL_SCHEMAS)
	for sub_agent_tool in get_sub_agent_definitions():
		name = sub_agent_tool.get("function", {}).get("name")
		if name:
			schemas[name] = sub_agent_tool
	return schemas

def get_tools_for_agent(profile_or_key: Any) -> List[dict]:
	from services.agent_manager import AgentProfile, load_agent_profile
	if isinstance(profile_or_key, AgentProfile):
		profile = profile_or_key
	else:
		profile = load_agent_profile(str(profile_or_key))

	if not profile.tools_config:
		return []

	master = get_master_tool_schemas()
	agent_tools = []

	for tool_name, tool_cfg in profile.tools_config.items():
		if tool_name in master:
			tool_copy = copy.deepcopy(master[tool_name])
			custom_purpose = tool_cfg.get("purpose")
			if custom_purpose:
				tool_copy["function"]["description"] = custom_purpose
			agent_tools.append(tool_copy)

	return agent_tools

# Default native tools for the main assistant
NATIVE_TOOLS = get_tools_for_agent("system_prompt")
