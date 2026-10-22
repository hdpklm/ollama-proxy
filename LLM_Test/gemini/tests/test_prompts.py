import sys
import os

# Test interface backend config loading
sys.path.insert(0, os.path.abspath("interface/backend"))
from config import load_prompt, load_default_system_prompt, get_prompts_dir

print("Prompts dir detected:", get_prompts_dir())
print("Main prompt loaded:", load_default_system_prompt()[:80].replace("\n", " "))
print("Coder prompt loaded:", load_prompt("coder")[:80].replace("\n", " "))
print("Researcher prompt loaded:", load_prompt("researcher")[:80].replace("\n", " "))
print("Writer prompt loaded:", load_prompt("writer")[:80].replace("\n", " "))

# Test backend prompt_cache loading
sys.path.insert(0, os.path.abspath("."))
from backend.prompt_cache import DEFAULT_AGENT_PROMPTS
print("PromptCache loaded agents:", list(DEFAULT_AGENT_PROMPTS.keys()))
for k, v in DEFAULT_AGENT_PROMPTS.items():
	print(f"  [{k}]: {v[:60].replace(chr(10), ' ')}...")
print("ALL TESTS PASSED")
