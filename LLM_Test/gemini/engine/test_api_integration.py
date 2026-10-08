import os
import sys
sys.path.insert(0, os.path.abspath("."))
from starlette.testclient import TestClient
from main import app

def run_integration_tests():
	with TestClient(app) as client:
		# 1. Test /v1/models
		resp = client.get("/v1/models", headers={"Authorization": "Bearer cambia_esta_clave"})
		print("[TEST 1 /v1/models status]:", resp.status_code, resp.json())
		assert resp.status_code == 200

		# 2. Test /api/generate
		gen_resp = client.post("/api/generate", json={
			"prompt": "Say hello in one word",
			"priority": True,
			"max_tokens": 5
		})
		print("[TEST 2 /api/generate status]:", gen_resp.status_code, gen_resp.json())
		assert gen_resp.status_code == 200
		data = gen_resp.json()
		assert "response" in data
		assert data.get("priority") is True
		assert "kv_cache_ram_mb" in data

		# 3. Test /v1/chat/completions (urgent)
		chat_resp = client.post("/v1/chat/completions", headers={"Authorization": "Bearer cambia_esta_clave"}, json={
			"model": "default",
			"priority": True,
			"max_tokens": 5,
			"messages": [{"role": "user", "content": "Say hi"}]
		})
		print("[TEST 3 /v1/chat/completions status]:", chat_resp.status_code, chat_resp.json())
		assert chat_resp.status_code == 200

	print("All integration tests passed successfully!")

if __name__ == "__main__":
	run_integration_tests()
