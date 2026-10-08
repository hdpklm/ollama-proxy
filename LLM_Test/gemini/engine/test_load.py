from llama_cpp import Llama

model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-74701a8c35f6c8d9a4b91f3f3497643001d63e0c7a84e085bed452548fa88d45"

print("Loading model...")
llm = Llama(
	model_path=model_path,
	n_ctx=512,
	n_threads=4,
	verbose=True
)
print("Model loaded successfully!")

response = llm("Hello, how are you?", max_tokens=10)
print("Generation output:", response)
