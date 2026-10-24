import sys
import os
import json
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("interface/backend"))

from config import load_default_system_prompt
from tools import get_tools_for_agent
from services.agent_manager import load_agent_profile
from backend.prompt_cache import PromptCacheManager

cache_mgr = PromptCacheManager()

# Let's inspect the tokenizer and formatter on proxy or local if llama_cpp is available
print("Testing prompt formatting and tokenization...")
base_sys = load_default_system_prompt()
profile = load_agent_profile("system_prompt")
tools = get_tools_for_agent(profile)

msg_t1 = [
	{"role": "system", "content": base_sys},
	{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:00]\nHola"}
]
asst_content = "¡Hola! Estoy listo para ayudarte. ¿Qué necesitas?"

msg_t1_plus_asst = [
	{"role": "system", "content": base_sys},
	{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:00]\nHola"},
	{"role": "assistant", "content": asst_content}
]

msg_t2 = [
	{"role": "system", "content": base_sys},
	{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:00]\nHola"},
	{"role": "assistant", "content": asst_content},
	{"role": "user", "content": "[Fecha y hora actual: 2026-10-24 12:05:05]\n¿Qué hora es?"}
]

print("Messages built successfully.")
