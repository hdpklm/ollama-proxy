from llama_cpp import Llama

model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-74701a8c35f6c8d9a4b91f3f3497643001d63e0c7a84e085bed452548fa88d45"

llm = Llama(model_path=model_path, n_ctx=1024, n_threads=4, verbose=False)

messages = [{"role": "user", "content": "Say hello in one word"}]
res = llm.create_chat_completion(messages=messages, max_tokens=10, stream=False)
print("Chat completion output:", res)
