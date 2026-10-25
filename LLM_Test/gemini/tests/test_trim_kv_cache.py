import os
import sys
import time
import numpy as np
import llama_cpp
from backend.config import resolve_model_path

def truncate_llm_state(llm: llama_cpp.Llama, target_tokens: int) -> bool:
	"""
	Desplaza el cursor del KV cache hacia atrás hasta `target_tokens`.
	Elimina todas las posiciones >= target_tokens en la memoria del modelo
	y ajusta el estado interno de Llama para continuar evaluando a partir de allí.
	"""
	current_tokens = llm.n_tokens
	if target_tokens >= current_tokens:
		return True
	if target_tokens < 0:
		return False

	try:
		if hasattr(llm._ctx, "kv_cache_seq_rm"):
			llm._ctx.kv_cache_seq_rm(-1, target_tokens, -1)
		elif hasattr(llama_cpp, "llama_memory_seq_rm"):
			llama_cpp.llama_memory_seq_rm(llm._ctx.ctx, -1, target_tokens, -1)
		else:
			print("[Truncate] No se encontró función para podar memoria de secuencia.")
			return False
	except Exception as e:
		print(f"[Truncate] Error al podar KV cache: {e}")
		return False

	llm.n_tokens = target_tokens
	llm.input_ids[target_tokens:] = 0
	llm._requires_eval = False
	return True


def run_experiment():
	model_path = resolve_model_path()
	print(f"Cargando modelo de prueba desde: {model_path}...")
	llm = llama_cpp.Llama(
		model_path=model_path,
		n_ctx=512,
		n_threads=4,
		logits_all=True,
		verbose=False
	)

	prompt_base = "El gato come pescado en el tejado todas las noches."
	prompt_variant_A = prompt_base + " Y luego se duerme profundamente."
	prompt_variant_B = prompt_base + " Pero hoy vino un perro y ladro."

	tokens_A = list(llm.tokenize(prompt_variant_A.encode("utf-8")))
	tokens_B = list(llm.tokenize(prompt_variant_B.encode("utf-8")))
	tokens_base = list(llm.tokenize(prompt_base.encode("utf-8")))

	common_prefix_len = 0
	for t_a, t_b in zip(tokens_A, tokens_B):
		if t_a == t_b:
			common_prefix_len += 1
		else:
			break
	print(f"Longitud prefijo comun entre A y B: {common_prefix_len}")

	# 1. Evaluar Variante A completa y guardar estado
	llm.reset()
	llm.eval(tokens_A)
	state_A = llm.save_state()

	# 2. Evaluar Variante B desde CERO
	llm.reset()
	t0 = time.time()
	llm.eval(tokens_B)
	eval_time_B_scratch = time.time() - t0
	logits_scratch = np.copy(llm.scores[llm.n_tokens - 1, :])

	# Generar 5 tokens con MUESTREO GREEDY (temp=0, top_k=1)
	gen_tokens_scratch = []
	for _ in range(5):
		tok = llm.sample(temp=0.0, top_k=1)
		gen_tokens_scratch.append(tok)
		llm.eval([tok])
	text_scratch = llm.detokenize(gen_tokens_scratch).decode("utf-8", errors="ignore")
	print(f"Texto generado desde CERO (greedy): '{text_scratch}'")

	# 3. Restaurar estado A y PODAR hasta common_prefix_len
	llm.reset()
	llm.load_state(state_A)
	truncate_llm_state(llm, common_prefix_len)

	# Evaluar solo la diferencia de B
	remaining_tokens_B = tokens_B[common_prefix_len:]
	t0 = time.time()
	llm.eval(remaining_tokens_B)
	eval_time_B_cached = time.time() - t0
	logits_trimmed = np.copy(llm.scores[llm.n_tokens - 1, :])

	# Generar 5 tokens con MUESTREO GREEDY (temp=0, top_k=1)
	gen_tokens_trimmed = []
	for _ in range(5):
		tok = llm.sample(temp=0.0, top_k=1)
		gen_tokens_trimmed.append(tok)
		llm.eval([tok])
	text_trimmed = llm.detokenize(gen_tokens_trimmed).decode("utf-8", errors="ignore")
	print(f"Texto generado con CURSOR DESPLAZADO (greedy): '{text_trimmed}'")

	# Comparacion de Logits
	diff = np.max(np.abs(logits_scratch - logits_trimmed))
	logits_identical = np.allclose(logits_scratch, logits_trimmed, atol=1e-3)
	tokens_match = (gen_tokens_scratch == gen_tokens_trimmed)
	speedup = (eval_time_B_scratch / eval_time_B_cached) if eval_time_B_cached > 0 else 0

	print(f"\n--- RESULTADO DE LA PRUEBA ---")
	print(f"Diferencia maxima absoluta en logits: {diff:.6e}")
	print(f"¿Logits numericamente identicos?: {logits_identical}")
	print(f"¿Tokens generados identicos?: {tokens_match}")
	print(f"Aceleracion de evaluacion: {speedup:.2f}x mas rapido")

	if tokens_match and logits_identical:
		print(">> PRUEBA SUPERADA CON EXITO: Resultados 100% identicos <<")
	else:
		print(">> ATENCION: Hay discrepancia en los resultados <<")

if __name__ == "__main__":
	run_experiment()
