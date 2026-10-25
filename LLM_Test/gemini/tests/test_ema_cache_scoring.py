import sys
sys.path.insert(0, ".")
import time
import math
from backend.prompt_cache import PromptCacheManager

def test_ema_scoring_and_eviction():
	print("--- TEST 1: EMA Scoring & Eviction ---")
	# Creamos manager con limite de 2 caches temporales y vida media de 30 minutos (1800s)
	mgr = PromptCacheManager(max_caches=2, ttl_seconds=0, half_life_seconds=1800)
	mgr.temporal_caches.clear()

	now = time.time()

	# Cache A: Usado 100 veces pero hace 6 horas (21600s = 12 vidas medias)
	cache_A = {
		"cache_id": "cache_old_frequent",
		"tokens": [1, 2, 3],
		"token_count": 3,
		"state": "state_A",
		"last_used": now - 21600,
		"ema_score": 100.0,
		"hit_count": 100,
		"is_system": False
	}
	# Cache B: Usado 3 veces hace 10 minutos (600s = 0.33 vidas medias)
	cache_B = {
		"cache_id": "cache_recent_active",
		"tokens": [1, 2, 4],
		"token_count": 3,
		"state": "state_B",
		"last_used": now - 600,
		"ema_score": 3.0,
		"hit_count": 3,
		"is_system": False
	}

	mgr.temporal_caches.append(cache_A)
	mgr.temporal_caches.append(cache_B)

	score_A = mgr.calculate_current_ema(cache_A, now)
	score_B = mgr.calculate_current_ema(cache_B, now)

	print(f"Score actual Cache A (100 usos hace 6h): {score_A:.6f}")
	print(f"Score actual Cache B (3 usos hace 10m):  {score_B:.6f}")
	assert score_B > score_A, "El cache reciente B debe tener mas valor que el antiguo A"

	# Agregamos un nuevo cache C (supera el limite de 2)
	mgr.save_or_replace_temporal_cache(None, [1, 5, 6], "state_C")

	remaining_ids = [c["cache_id"] for c in mgr.temporal_caches]
	print(f"Caches restantes en memoria (limite 2): {remaining_ids}")

	assert "cache_old_frequent" not in remaining_ids, "El cache antiguo A debio ser desalojado por bajo EMA"
	assert "cache_recent_active" in remaining_ids, "El cache reciente B debio permanecer"
	print(">> Test 1 superado: El desalojo por EMA funciona correctamente.\n")


def test_inplace_extension():
	print("--- TEST 2: In-Place Extension cuando el cache esta contenido ---")
	mgr = PromptCacheManager(max_caches=5, ttl_seconds=0)
	mgr.temporal_caches.clear()

	# Turno 1: Se guarda un cache con 10 tokens
	tokens_turn1 = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
	mgr.save_or_replace_temporal_cache(None, tokens_turn1, "state_turn1")
	assert len(mgr.temporal_caches) == 1
	cache_entry = mgr.temporal_caches[0]
	initial_cache_id = cache_entry["cache_id"]
	print(f"Cache inicial creado: {initial_cache_id} ({cache_entry['token_count']} tokens)")

	# Turno 2: Llega un nuevo mensaje del usuario + respuesta (14 tokens).
	# Todos los tokens del cache inicial estan contenidos al principio:
	tokens_turn2 = tokens_turn1 + [101, 102, 103, 104]
	mgr.save_or_replace_temporal_cache(cache_entry, tokens_turn2, "state_turn2")

	assert len(mgr.temporal_caches) == 1, "No debe crear una entrada nueva, debe reemplazar in-place"
	assert mgr.temporal_caches[0]["cache_id"] == initial_cache_id, "El cache_id debe mantenerse"
	assert mgr.temporal_caches[0]["token_count"] == 14, "El token_count debe extenderse a 14"
	assert mgr.temporal_caches[0]["state"] == "state_turn2", "El estado debe actualizarse"
	print(f"Cache extendido in-place: {mgr.temporal_caches[0]['cache_id']} ({mgr.temporal_caches[0]['token_count']} tokens)")
	print(">> Test 2 superado: Extension in-place funciona correctamente.\n")


def test_system_prompt_immutability():
	print("--- TEST 3: Inmutabilidad de System Prompts ---")
	mgr = PromptCacheManager()
	main_agent_hash = mgr.agent_hash_map.get("main_agent")
	if main_agent_hash and main_agent_hash in mgr.ram_cache:
		sys_cache = mgr.ram_cache[main_agent_hash]
		original_tokens = list(sys_cache["tokens"])
		original_token_count = sys_cache["token_count"]

		# Simulamos que una peticion usa el system prompt y genera tokens
		new_tokens = original_tokens + [9999, 8888]
		mgr.save_or_replace_temporal_cache(sys_cache, new_tokens, "state_extended")

		# El system prompt no debe haberse tocado
		assert sys_cache["tokens"] == original_tokens, "El system prompt NO debe cambiar sus tokens"
		assert sys_cache["token_count"] == original_token_count, "El system prompt NO debe cambiar su longitud"

		# Y debe haber creado una entrada temporal nueva para el dialogo
		temp_entries = [c for c in mgr.temporal_caches if c["tokens"] == new_tokens]
		assert len(temp_entries) == 1, "Debe crearse una nueva entrada en temporales para competir por EMA"
		print(f"System prompt protegido intacto ({original_token_count} tokens). Nuevo temporal creado: {temp_entries[0]['cache_id']}")
		print(">> Test 3 superado: System prompts completamente inmutables.\n")

if __name__ == "__main__":
	test_ema_scoring_and_eviction()
	test_inplace_extension()
	test_system_prompt_immutability()
	print("TODOS LOS TESTS DE EMA Y GESTION DE CACHE SUPERADOS EXITOSAMENTE.")
