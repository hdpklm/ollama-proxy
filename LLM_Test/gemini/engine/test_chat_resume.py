from llama_cpp import Llama

model_path = r"E:\LLM-Models\.ollama\models\blobs\sha256-74701a8c35f6c8d9a4b91f3f3497643001d63e0c7a84e085bed452548fa88d45"

llm = Llama(model_path=model_path, n_ctx=1024, n_threads=4, verbose=False)

messages = [{"role": "user", "content": "Count from 1 to 10"}]
print("First chunk of 3 tokens:")
stream1 = llm.create_chat_completion(messages=messages, max_tokens=3, stream=True)
accumulated = ""
for chunk in stream1:
	content = chunk["choices"][0]["delta"].get("content", "")
	accumulated += content
	print(repr(content), end=" ", flush=True)
print("\nAccumulated so far:", repr(accumulated))

print("\nResuming with assistant partial message:")
resume_messages = [*messages, {"role": "assistant", "content": accumulated}]
stream2 = llm.create_chat_completion(messages=resume_messages, max_tokens=7, stream=True)
for chunk in stream2:
	content = chunk["choices"][0]["delta"].get("content", "")
	accumulated += content
	print(repr(content), end=" ", flush=True)
print("\nFinal text:", repr(accumulated))
