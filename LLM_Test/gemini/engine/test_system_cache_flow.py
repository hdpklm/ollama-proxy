import sys
import io
import time
from llama_cpp import Llama

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-6dd7ac24fe13a238898e16e253ebc7a72fa27fb83f2658c2f6c241df3af5937d"
llm = Llama(model_path, n_ctx=512, verbose=True)

handler = llm._chat_handlers["chat_template.default"]
formatter = handler.__closure__[0].cell_contents

sys_text = "Eres un asistente conversacional inteligente, conciso y directo en español." * 4
# Formatear el system prompt
res_sys = formatter(messages=[{"role": "system", "content": sys_text}])
sys_str = res_sys.prompt.split("<|turn>model\n")[0]
print("sys_str:", repr(sys_str))

sys_toks = llm.tokenize(sys_str.encode("utf-8"), add_bos=False)
print("sys_toks count:", len(sys_toks))

# Pre-evaluar
t_eval0 = time.time()
llm.eval(sys_toks)
t_eval1 = time.time()
print("Pre-eval time:", round(t_eval1 - t_eval0, 3), "s")

state = llm.save_state()
print("Saved state with n_tokens:", llm.n_tokens)

# Reset y restore
llm.reset()
print("After reset:", llm.n_tokens)
llm.load_state(state)
print("After load_state:", llm.n_tokens)

# Ahora llamada con el system prompt + usuario
t0 = time.time()
res = llm.create_chat_completion(
	messages=[
		{"role": "system", "content": sys_text},
		{"role": "user", "content": "Di hola"}
	],
	max_tokens=5
)
t1 = time.time()
print("Inference time with cached system prompt:", round(t1 - t0, 3), "s")
print("Generated:", res["choices"][0]["message"])
