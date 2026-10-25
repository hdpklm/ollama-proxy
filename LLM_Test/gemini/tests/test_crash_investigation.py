import sys
import os
import time
import llama_cpp
from backend.config import resolve_model_path

def test_long_state_and_truncate():
	model_path = resolve_model_path()
	print(f"Cargando modelo: {model_path}")
	llm = llama_cpp.Llama(model_path=model_path, n_ctx=2048, n_threads=4, verbose=False)

	# Creamos una secuencia de unos 1200 tokens
	text = ("El zorro marron salta rapidamente sobre el perro perezoso en el bosque encantado. " * 75)
	tokens = list(llm.tokenize(text.encode("utf-8")))[:1200]
	print(f"Tokens a evaluar: {len(tokens)}")

	llm.reset()
	llm.eval(tokens)
	print(f"Evaluados {llm.n_tokens} tokens.")

	state = llm.save_state()
	print(f"Estado guardado: size={state.llama_state_size} bytes ({state.llama_state_size/(1024*1024):.2f} MB)")

	# Ahora probamos: cargar ese estado y truncar a 1187 tokens (igual que en el log que crasheo)
	print("Probando llm.load_state(state)...")
	llm.reset()
	llm.load_state(state)
	print(f"load_state completado. n_tokens={llm.n_tokens}")

	target_trim = 1187
	print(f"Probando poda/truncado a {target_trim} tokens...")
	if hasattr(llm._ctx, "kv_cache_seq_rm"):
		print("Llamando a llm._ctx.kv_cache_seq_rm(-1, 1187, -1)...")
		res = llm._ctx.kv_cache_seq_rm(-1, target_trim, -1)
		print(f"Resultado kv_cache_seq_rm: {res}")
	llm.n_tokens = target_trim
	llm.input_ids[target_trim:] = 0
	llm._requires_eval = True

	# Evaluamos 20 tokens nuevos
	new_tokens = [100, 101, 102, 103, 104]
	print("Evaluando nuevos tokens tras truncado...")
	llm.eval(new_tokens)
	print(f"Exito rotundo. Nuevo n_tokens: {llm.n_tokens}")

if __name__ == "__main__":
	test_long_state_and_truncate()
