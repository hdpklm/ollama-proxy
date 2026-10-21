import re
import json

def parse_gemma_tool_call(text: str):
	# Pattern 1: Gemma 4 special tokens <|tool_call>call:func{args}<tool_call|>
	# or plain call:func{args}
	pattern = r'(?:<\|tool_call>)?call:([a-zA-Z0-9_]+)\{(.*?)\}(?:<tool_call\|>)?'
	match = re.search(pattern, text, re.DOTALL)
	if not match:
		return None, None, None

	fn_name = match.group(1).strip()
	raw_body = match.group(2).strip()
	full_raw = match.group(0)

	# Replace Gemma quote escape tokens <|"|> with "
	cleaned = raw_body.replace('<|"|>', '"')

	# Handle key: "value" or key: 'value' or key: value
	# Quote unquoted keys: query: "..." -> "query": "..."
	cleaned = re.sub(r'([a-zA-Z0-9_]+)\s*:', r'"\1":', cleaned)
	json_str = "{" + cleaned + "}"

	try:
		args = json.loads(json_str)
	except Exception:
		# Fallback regex extraction of key-value pairs
		args = {}
		for k, v in re.findall(r'"?([a-zA-Z0-9_]+)"?\s*:\s*"?([^",}]+)"?', cleaned):
			args[k] = v.strip().strip('"')

	return fn_name, args, full_raw

sample = '<|tool_call>call:search_web{query:<|"|>tiempo mañana en Barcelona<|"|>}<tool_call|>'
fn, args, raw = parse_gemma_tool_call(sample)
print("Function:", fn)
print("Args:", args)
print("Raw:", raw)
