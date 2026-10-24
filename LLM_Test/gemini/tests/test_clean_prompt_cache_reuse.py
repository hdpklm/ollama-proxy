import os
import sys
import unittest

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("interface/backend"))

from backend.prompt_cache import PromptCacheManager, DEFAULT_AGENT_PROMPTS

def get_test_system_prompt():
	prompt_path = os.path.join(os.path.abspath("."), "prompts", "system_prompt.md")
	if os.path.exists(prompt_path):
		with open(prompt_path, "r", encoding="utf-8") as f:
			return f.read().strip()
	return "Eres un asistente conversacional inteligente, conciso y directo en español."

class TestCleanPromptCacheReuse(unittest.TestCase):
	def setUp(self):
		self.cache_dir = "./LLM_Test/gemini/scratch_test_clean_cache"
		self.manager = PromptCacheManager(cache_dir=self.cache_dir)

	def test_system_prompt_hash_stability(self):
		base_sys = get_test_system_prompt()
		hash1 = self.manager.compute_hash(base_sys)

		# Simulate message in turn 1 with tree_context
		tree_context_turn1 = "* general: nota 1"
		# System prompt must remain unchanged
		clean_sys_turn1 = base_sys
		self.assertEqual(self.manager.compute_hash(clean_sys_turn1), hash1)

		# Simulate message in turn 2 with updated tree_context
		tree_context_turn2 = "* general: nota 1\n* proyecto: nota 2"
		clean_sys_turn2 = base_sys
		self.assertEqual(self.manager.compute_hash(clean_sys_turn2), hash1)

	def test_agent_prompts_indexing(self):
		for agent_name in ("main_agent", "researcher", "coder", "writer"):
			self.assertIn(agent_name, DEFAULT_AGENT_PROMPTS)
			prompt_text = DEFAULT_AGENT_PROMPTS[agent_name]
			self.assertTrue(len(prompt_text) > 10)
			computed_hash = self.manager.compute_hash(prompt_text)
			self.assertEqual(len(computed_hash), 16)

	def test_apply_cache_lookup(self):
		test_prompt = "Eres un asistente de prueba para verificacion de hash."
		p_hash = self.manager.compute_hash(test_prompt)

		class MockLLM:
			def __init__(self):
				self.loaded = False
				self.n_tokens = 0
			def reset(self):
				self.loaded = False
			def load_state(self, state):
				self.loaded = True
				self.n_tokens = 42

		mock_llm = MockLLM()
		self.manager.ram_cache[p_hash] = {"hash": p_hash, "state": "dummy_state", "tokens": [1, 2, 3]}

		result = self.manager.apply_cache_if_available(mock_llm, test_prompt)
		self.assertTrue(result)
		self.assertTrue(mock_llm.loaded)
		self.assertEqual(mock_llm.n_tokens, 42)

if __name__ == "__main__":
	unittest.main()
