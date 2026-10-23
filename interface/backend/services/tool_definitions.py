from tools import get_master_tool_schemas, get_tools_for_agent, TOOL_REGISTRY

# Re-export master schemas and default agent tools from centralized tools package
BASE_TOOL_SCHEMAS = get_master_tool_schemas()
NATIVE_TOOLS = get_tools_for_agent("system_prompt")
