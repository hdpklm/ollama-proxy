import os
import sys
import shutil
import pickle

sys.path.insert(0, os.path.abspath("."))

from backend.prompt_cache import PromptCacheManager

TEST_CACHE_DIR = "./LLM_Test/gemini/engine/scratch_prompt_cache"

def test_cache_workflow():
	if os.path.exists(TEST_CACHE_DIR):
		shutil.rmtree(TEST_CACHE_DIR)

	manager = PromptCacheManager(cache_dir=TEST_CACHE_DIR)

	prompt_v1 = "System prompt version 1 for test agent"
	hash_v1 = manager.compute_hash(prompt_v1)
	dummy_state_v1 = {"kv_data": b"mock_kv_state_12345", "tokens": [101, 102, 103]}

	# 1. Save v1
	saved_hash1 = manager.save_cache("test_agent", prompt_v1, dummy_state_v1, dummy_state_v1["tokens"])
	assert saved_hash1 == hash_v1
	file_v1 = manager.get_cache_filepath("test_agent", hash_v1)
	assert os.path.exists(file_v1), f"Expected file {file_v1} to exist"
	print("Step 1: Saved v1 successfully.")

	# 2. Check RAM lookup
	loaded_state = manager.get_cached_state_by_hash(hash_v1)
	assert loaded_state == dummy_state_v1, "RAM state must match"
	print("Step 2: RAM lookup matches v1.")

	# 3. Simulate hash change (prompt v2)
	prompt_v2 = "System prompt version 2 with modified instructions"
	hash_v2 = manager.compute_hash(prompt_v2)
	assert hash_v1 != hash_v2
	dummy_state_v2 = {"kv_data": b"mock_kv_state_99999", "tokens": [201, 202]}

	saved_hash2 = manager.save_cache("test_agent", prompt_v2, dummy_state_v2, dummy_state_v2["tokens"])
	assert saved_hash2 == hash_v2
	file_v2 = manager.get_cache_filepath("test_agent", hash_v2)

	# Verify stale v1 was deleted and v2 exists
	assert not os.path.exists(file_v1), f"Stale file {file_v1} should have been deleted"
	assert os.path.exists(file_v2), f"New file {file_v2} must exist"
	print("Step 3: Stale cache deleted and new hash saved.")

	# 4. Simulate container restart (loading from disk to RAM only configured prompts)
	# Create an orphan binary that is NOT in configured_prompts
	orphan_file = os.path.join(TEST_CACHE_DIR, "orphan_agent_deadbeef12345678.bin")
	with open(orphan_file, "wb") as f:
		pickle.dump({"hash": "deadbeef12345678", "agent_name": "orphan_agent", "state": "mock_orphan"}, f)

	# Manager configured ONLY with test_agent (prompt_v2)
	new_manager = PromptCacheManager(
		cache_dir=TEST_CACHE_DIR,
		configured_prompts={"test_agent": prompt_v2}
	)
	restored_state = new_manager.get_cached_state_by_hash(hash_v2)
	assert restored_state == dummy_state_v2, "Restored state after restart must match v2"
	assert new_manager.get_cached_state_by_hash(hash_v1) is None, "Old hash must not be loaded"
	assert new_manager.get_cached_state_by_hash("deadbeef12345678") is None, "Unconfigured orphan binary must NOT be loaded to RAM"
	print("Step 4: Only configured prompt caches loaded into RAM, unconfigured binaries ignored.")

	# 5. Test caller context snapshot stack during sub-agent delegation
	caller_dummy_state = {"caller_tokens": [1, 2, 3], "kv_mem": b"caller_active_kv"}
	new_manager.save_snapshot("caller_before_researcher", caller_dummy_state)
	assert new_manager.get_snapshot("caller_before_researcher") == caller_dummy_state
	popped_caller = new_manager.pop_snapshot("caller_before_researcher")
	assert popped_caller == caller_dummy_state
	assert new_manager.get_snapshot("caller_before_researcher") is None
	print("Step 5: Caller context preserved in RAM and restored seamlessly.")

	print("\nALL PROMPT CACHE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
	test_cache_workflow()
