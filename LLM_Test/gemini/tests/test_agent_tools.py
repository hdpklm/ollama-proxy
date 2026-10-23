import sys
import os

sys.path.insert(0, os.path.abspath("interface/backend"))
sys.path.insert(0, os.path.abspath("."))

from services.agent_manager import load_agent_profile
from services.tool_definitions import get_tools_for_agent
from backend.prompt_cache import DEFAULT_AGENT_PROMPTS, PromptCacheManager

print("=== 1. Test Agent Profiles & Tool Schemas ===")
for agent_key in ["system_prompt", "researcher", "coder", "writer"]:
	profile = load_agent_profile(agent_key)
	tools = get_tools_for_agent(profile)
	tool_names = [t["function"]["name"] for t in tools]
	print(f"[{profile.name}] ({profile.role}) Temp: {profile.temperature}")
	print(f"  Herramientas ({len(tool_names)}): {tool_names}")
	assert profile.temperature is not None
	if agent_key == "researcher":
		assert "search_web" in tool_names
		assert "read_url" in tool_names
		assert "read_pdf" in tool_names
		assert len(tool_names) == 3
	elif agent_key == "coder":
		assert "read_url" in tool_names
		assert len(tool_names) == 1
	elif agent_key == "writer":
		assert len(tool_names) == 0
	elif agent_key == "system_prompt":
		assert "search_web" in tool_names
		assert "delegate_to_researcher" in tool_names
		assert "delegate_to_coder" in tool_names
		assert "delegate_to_writer" in tool_names

print("\n=== 2. Test Effective Prompt Injection ===")
res_prof = load_agent_profile("researcher")
eff_prompt = res_prof.get_effective_prompt()
assert "## Herramientas Asignadas y Directrices de Uso" in eff_prompt
assert "`search_web`" in eff_prompt
assert "Límite por turno" in eff_prompt
print("Researcher effective prompt contains tool rules and limits: OK")

print("\n=== 3. Test Guardrail Enforcement ===")
# Researcher can call search_web up to 3 times
can_run, reason = res_prof.can_execute_tool("search_web", 0)
assert can_run, f"Expected can_run=True, got {can_run}"
can_run, reason = res_prof.can_execute_tool("search_web", 2)
assert can_run, f"Expected can_run=True, got {can_run}"
can_run, reason = res_prof.can_execute_tool("search_web", 3)
assert not can_run, "Expected can_run=False on limit"
print("Researcher limit enforcement on 4th call: OK ->", reason[:60])

# Coder cannot call search_web
coder_prof = load_agent_profile("coder")
can_run, reason = coder_prof.can_execute_tool("search_web", 0)
assert not can_run, "Expected unauthorized tool to be rejected"
print("Coder unauthorized tool rejection: OK ->", reason)

print("\n=== 4. Test PromptCache Synchronization ===")
pcm = PromptCacheManager()
for agent_key in ["researcher", "coder", "writer"]:
	prof = load_agent_profile(agent_key)
	expected = prof.get_effective_prompt()
	cached = DEFAULT_AGENT_PROMPTS[agent_key]
	assert expected.strip() == cached.strip(), f"Mismatch in prompt for {agent_key}"
	print(f"Hash sync for {agent_key}: SHA256({pcm.compute_hash(cached)}) OK")

print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")
