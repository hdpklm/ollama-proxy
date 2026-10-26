import time
import unittest
from typing import Any
from backend.prompt_cache import CacheTreeNode, PromptCacheManager

class DummyLLM:
	def __init__(self):
		self.state = "dummy_state_full"
		self.n_tokens = 0
		self.loaded_states = []

	def token_eos(self) -> int:
		return 107

	def tokenize(self, text: bytes, add_bos: bool = False, special: bool = True) -> list[int]:
		if b"<end_of_turn>" in text:
			return [107]
		if b"<|im_end|>" in text:
			return [151645]
		return [999]

	def load_state(self, state: Any):
		self.state = state
		self.loaded_states.append(state)

	def save_state(self) -> Any:
		return f"state_after_eval_{self.n_tokens}"

	def reset(self):
		self.state = None
		self.n_tokens = 0


class TestRadixTreeCache(unittest.TestCase):
	def setUp(self):
		self.mgr = PromptCacheManager(
			cache_dir="./cache/test_prompt_states",
			configured_prompts={},
			max_caches=5,
			ttl_seconds=60,
			half_life_seconds=1800,
			replace_tolerance=15
		)
		self.llm = DummyLLM()

	def test_system_prompt_layer_1(self):
		# System prompt tokens: [1, 2, 3, 4]
		sys_tokens = [1, 2, 3, 4]
		self.mgr.save_cache("agent_test", "Test Prompt", "sys_state_1234", sys_tokens)

		self.assertEqual(len(self.mgr.root.children), 1)
		sys_node = self.mgr.root.children[0]
		self.assertTrue(sys_node.is_system)
		self.assertEqual(sys_node.tokens, sys_tokens)

		# Find best matching node
		node, matched = self.mgr.find_best_matching_node(self.llm, [1, 2, 3, 4, 10, 20])
		self.assertEqual(node, sys_node)
		self.assertEqual(matched, 4)

	def test_node_split_and_branching(self):
		# Create root -> sys_node [1, 2, 3] -> turn_1 [10, 20, 30, 40]
		sys_tokens = [1, 2, 3]
		self.mgr.save_cache("main", "Main Sys", "sys_state", sys_tokens)
		sys_node = self.mgr.root.children[0]

		# Insert turn 1 under sys_node
		self.mgr.save_or_replace_temporal_cache(sys_node, [1, 2, 3, 10, 20, 30, 40], "turn1_state")
		self.assertEqual(len(sys_node.children), 1)
		child_1 = sys_node.children[0]
		self.assertEqual(child_1.tokens, [10, 20, 30, 40])

		# Request shares partial prefix [10, 20] but diverges at [99] -> [1, 2, 3, 10, 20, 99]
		req_tokens = [1, 2, 3, 10, 20, 99]
		node, matched = self.mgr.find_best_matching_node(self.llm, req_tokens)

		# matched should be 3 (sys) + 2 (10, 20) = 5
		self.assertEqual(matched, 5)
		# Node was split into prefix [10, 20]
		self.assertEqual(node.tokens, [10, 20])
		# Node has hija_1 with suffix [30, 40]
		self.assertEqual(len(node.children), 1)
		hija_1 = node.children[0]
		self.assertEqual(hija_1.tokens, [30, 40])

		# Post generation for the diverging request [1, 2, 3, 10, 20, 99, 100]
		self.mgr.save_or_replace_temporal_cache(node, [1, 2, 3, 10, 20, 99, 100], "hija_2_state")
		# Now split node should have 2 daughters: hija_1 [30, 40] and hija_2 [99, 100]
		self.assertEqual(len(node.children), 2)
		hija_2 = node.children[1]
		self.assertEqual(hija_2.tokens, [99, 100])

	def test_pruning_never_prunes_system_prompts(self):
		sys_tokens = [1, 2, 3]
		self.mgr.save_cache("pinned_sys", "Pinned", "sys_state", sys_tokens)
		sys_node = self.mgr.root.children[0]

		# Set last_used far in the past
		sys_node.last_used = time.time() - 10000
		self.mgr.clean_expired_temporals()

		# System prompt node MUST still exist
		self.assertIn(sys_node, self.mgr.root.children)

	def test_pruning_cannot_prune_branch_with_children(self):
		sys_tokens = [1, 2, 3]
		self.mgr.save_cache("main", "Main", "sys_state", sys_tokens)
		sys_node = self.mgr.root.children[0]

		# Insert [1, 2, 3, 10, 20, 30]
		self.mgr.save_or_replace_temporal_cache(sys_node, [1, 2, 3, 10, 20, 30], "state_1")
		# Split on [10, 20] with [1, 2, 3, 10, 20, 99]
		split_node, _ = self.mgr.find_best_matching_node(self.llm, [1, 2, 3, 10, 20, 99])
		self.assertEqual(len(split_node.children), 1)
		child_node = split_node.children[0]

		# Make split_node expired, but child_node FRESH
		now = time.time()
		split_node.last_used = now - 10000
		child_node.last_used = now  # fresh

		# Run pruning
		self.mgr.clean_expired_temporals()

		# Parent MUST NOT be pruned because child is active
		self.assertIn(split_node, sys_node.children)
		self.assertIn(child_node, split_node.children)

		# Now expire child_node as well
		child_node.last_used = now - 10000
		self.mgr.clean_expired_temporals()

		# Now child_node is pruned as leaf, and split_node (now a leaf without children and expired) is also pruned!
		self.assertEqual(len(sys_node.children), 0)

	def test_enforce_max_caches_leaf_only(self):
		sys_tokens = [1, 2]
		self.mgr.save_cache("main", "Main", "sys_state", sys_tokens)
		sys_node = self.mgr.root.children[0]

		self.mgr.max_caches = 2

		# Add 3 separate branches under sys_node
		self.mgr.save_or_replace_temporal_cache(sys_node, [1, 2, 10], "state_1")
		self.mgr.save_or_replace_temporal_cache(sys_node, [1, 2, 20], "state_2")
		self.mgr.save_or_replace_temporal_cache(sys_node, [1, 2, 30], "state_3")

		# With max_caches=2, one leaf must be evicted based on EMA
		self.assertLessEqual(len(self.mgr.temporal_caches), 2)

	def test_strip_eos_and_subsequent_tokens(self):
		sys_tokens = [1, 2]
		self.mgr.save_cache("main", "Main", "sys_state", sys_tokens)
		sys_node = self.mgr.root.children[0]

		# Suppose EOS token is 107 (Gemma <end_of_turn>).
		# We pass tokens: [1, 2, 50, 60, 107, 70, 80] (tokens 70 and 80 generated after EOS)
		tokens_with_eos_and_trailing = [1, 2, 50, 60, 107, 70, 80]

		# strip_eos_tokens should yield only [1, 2, 50, 60]
		clean = self.mgr.strip_eos_tokens(self.llm, tokens_with_eos_and_trailing)
		self.assertEqual(clean, [1, 2, 50, 60])

		# When saving to cache, it must not contain 107 or anything after
		self.mgr.save_or_replace_temporal_cache(sys_node, clean, "clean_state")
		saved_node = sys_node.children[0]
		self.assertEqual(saved_node.tokens, [50, 60])
		self.assertNotIn(107, saved_node.tokens)
		self.assertNotIn(70, saved_node.tokens)
		self.assertNotIn(80, saved_node.tokens)

	def test_adapter_eos_isolation_prevents_false_positives(self):
		from backend.adapters.gemma4 import Gemma4Adapter
		from backend.adapters.qwen import QwenAdapter

		# 1. Gemma4Adapter: recognizes 107 as EOS, does NOT trigger on Qwen's 151645
		gemma_mgr = PromptCacheManager(adapter=Gemma4Adapter())
		gemma_mgr.init_adapter_eos(self.llm)
		tokens_with_qwen_token = [10, 20, 151645, 30]
		# Should NOT strip because 151645 is not Gemma's EOS!
		self.assertEqual(gemma_mgr.strip_eos_tokens(self.llm, tokens_with_qwen_token), tokens_with_qwen_token)

		# 2. QwenAdapter: recognizes 151645 as EOS
		class DummyQwenLLM:
			def token_eos(self): return 151645
			def tokenize(self, text: bytes, add_bos=False, special=True):
				if b"<|im_end|>" in text: return [151645]
				return [888]

		qwen_llm = DummyQwenLLM()
		qwen_mgr = PromptCacheManager(adapter=QwenAdapter())
		qwen_mgr.init_adapter_eos(qwen_llm)
		# Should strip at 151645
		self.assertEqual(qwen_mgr.strip_eos_tokens(qwen_llm, tokens_with_qwen_token), [10, 20])
		# And should NOT strip on Gemma's 107
		self.assertEqual(qwen_mgr.strip_eos_tokens(qwen_llm, [10, 20, 107, 30]), [10, 20, 107, 30])


if __name__ == "__main__":
	unittest.main()
