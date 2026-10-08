from llama_cpp import Llama

# gemma4:e2b main blob from Ollama
model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-6dd7ac24fe13a238898e16e253ebc7a72fa27fb83f2658c2f6c241df3af5937d"

print("Testing loading gemma4:e2b...")
try:
	llm = Llama(
		model_path=model_path,
		n_ctx=512,
		n_threads=4,
		verbose=False
	)
	print("gemma4:e2b loaded successfully!")
	res = llm("Hola mundo", max_tokens=5)
	print("Output:", res)
except Exception as e:
	print("Error loading gemma4:e2b:", e)
