import os
import sys

# Test script inside docker container to inspect llama_cpp formatting and tokenization
from llama_cpp import Llama
from backend.config import resolve_model_path, N_CTX_HIGH, N_THREADS

model_path = resolve_model_path()
print(f"Model path: {model_path}")

llm = Llama(
	model_path=model_path,
	n_ctx=512,
	n_threads=N_THREADS,
	verbose=False
)

messages = [
	{"role": "system", "content": "Eres un asistente util."},
	{"role": "user", "content": "Hola, que tal?"}
]

tools = [
	{
		"type": "function",
		"function": {
			"name": "get_weather",
			"description": "Get current weather",
			"parameters": {
				"type": "object",
				"properties": {
					"location": {"type": "string"}
				},
				"required": ["location"]
			}
		}
	}
]

# Check chat handler / formatter
handler = getattr(llm, "chat_handler", None)
if not handler and hasattr(llm, "_chat_handlers"):
	chat_fmt = getattr(llm, "chat_format", "chat_template.default")
	handler = llm._chat_handlers.get(chat_fmt) or llm._chat_handlers.get("chat_template.default")

print(f"Handler: {handler}")

if handler:
	# Check what arguments the formatter accepts
	import inspect
	print(f"Handler signature: {inspect.signature(handler)}")
	try:
		res_no_tools = handler(llama=llm, messages=messages)
		print("--- Formatted without tools ---")
		print(repr(res_no_tools))
	except Exception as e:
		print(f"Error without tools: {e}")

	try:
		res_tools = handler(llama=llm, messages=messages, tools=tools)
		print("--- Formatted with tools ---")
		print(repr(res_tools))
	except Exception as e:
		print(f"Error with tools: {e}")
