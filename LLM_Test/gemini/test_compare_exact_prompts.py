import sys
import os
import json
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("interface/backend"))

from config import load_default_system_prompt
from tools import get_tools_for_agent
from services.agent_manager import load_agent_profile
from backend.prompt_cache import DEFAULT_AGENT_PROMPTS, DEFAULT_AGENT_METADATA, build_tools_for_agent_metadata

sys_interface = load_default_system_prompt()
sys_proxy = DEFAULT_AGENT_PROMPTS["main_agent"]

print("=== SYSTEM PROMPT COMPARISON ===")
print("Interface len:", len(sys_interface))
print("Proxy len:    ", len(sys_proxy))
print("Are texts identical?:", sys_interface == sys_proxy)
if sys_interface != sys_proxy:
	import difflib
	diff = list(difflib.unified_diff(sys_proxy.splitlines(), sys_interface.splitlines(), fromfile="proxy", tofile="interface"))
	print("Diff:")
	print("\n".join(diff[:30]))

print("\n=== TOOLS COMPARISON ===")
profile = load_agent_profile("system_prompt")
tools_interface = get_tools_for_agent(profile)
tools_proxy = build_tools_for_agent_metadata(DEFAULT_AGENT_METADATA.get("main_agent", {}))

print("Interface tools count:", len(tools_interface))
print("Proxy tools count:    ", len(tools_proxy))
tools_iface_json = json.dumps(tools_interface, sort_keys=True)
tools_proxy_json = json.dumps(tools_proxy, sort_keys=True)
print("Are tools identical?:", tools_iface_json == tools_proxy_json)
if tools_iface_json != tools_proxy_json:
	print("Tools diff:")
	for t1, t2 in zip(tools_interface, tools_proxy):
		if t1 != t2:
			print("Mismatch:", t1.get("function", {}).get("name"))
			print("  Iface:", t1)
			print("  Proxy:", t2)
