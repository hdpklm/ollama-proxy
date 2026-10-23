import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath("interface/backend"))

from tools import TOOL_REGISTRY, get_tool_entry, get_master_tool_schemas, execute_tool
from tools.web import TOOLS as WEB_TOOLS
from tools.delegation import TOOLS as DELEGATION_TOOLS

print("=== 1. Validating Tools Registry & Category Files ===")
print("Web tools in tools/web.py:", list(WEB_TOOLS.keys()))
print("Delegation tools in tools/delegation.py:", list(DELEGATION_TOOLS.keys()))
print("Consolidated TOOL_REGISTRY:", list(TOOL_REGISTRY.keys()))

assert "search_web" in WEB_TOOLS
assert "read_url" in WEB_TOOLS
assert "read_pdf" in WEB_TOOLS
assert "delegate_to_researcher" in DELEGATION_TOOLS
assert "delegate_to_coder" in DELEGATION_TOOLS
assert "delegate_to_writer" in DELEGATION_TOOLS

print("\n=== 2. Validating Each Tool Has Linked Handler & Schema ===")
for name, entry in TOOL_REGISTRY.items():
	assert "schema" in entry, f"Missing schema in {name}"
	assert "handler" in entry, f"Missing handler in {name}"
	assert callable(entry["handler"]), f"Handler for {name} is not callable"
	func_schema = entry["schema"]["function"]
	assert func_schema["name"] == name, f"Mismatch function name for {name}"
	print(f"  [OK] {name}: Schema '{func_schema['name']}' linked to handler {entry['handler'].__name__ if hasattr(entry['handler'], '__name__') else '<callable>'}")

print("\n=== 3. Test Direct Execution Via Registry Handler ===")
async def test_exec():
	# Test with empty query to verify handler execution without network dependency
	res = await execute_tool("search_web", {"query": ""})
	assert "Consulta vacía" in res, f"Unexpected response: {res}"
	print("Execution of search_web handler:", res)

	# Test with unauthorized tool error
	res_bad = await execute_tool("non_existent_tool", {})
	assert "desconocida" in res_bad
	print("Execution of unknown tool correctly rejected:", res_bad)

asyncio.run(test_exec())
print("\n>>> ALL TOOLS PACKAGE TESTS PASSED! <<<")
