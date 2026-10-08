import os
import sys
sys.path.insert(0, os.path.abspath("."))
from llama_cpp import Llama
from backend.config import resolve_model_path

llm = Llama(resolve_model_path(), verbose=False)
messages = [{"role": "user", "content": "Tell a story about Rome"}]

# Method 1: chat formatter
try:
	formatted = llm.chat_handler(llm, messages=messages) if hasattr(llm, "chat_handler") else None
	print("chat_handler:", formatted)
except Exception as e:
	print("chat_handler err:", e)

# Method 2: check chat_format or tokenizer
print("chat_format:", getattr(llm, "chat_format", None))

# Let's check how llama_cpp formats messages internally:
from llama_cpp.llama_chat_format import get_chat_completion_handler, Jinja2ChatFormatter
handler = get_chat_completion_handler(llm.chat_format)
print("Handler:", handler)

# Format messages using the model's handler/template:
res = llm.create_chat_completion(messages=messages, max_tokens=1)
print("Prompt tokens count:", res["usage"]["prompt_tokens"])
