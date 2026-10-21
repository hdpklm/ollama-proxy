import json
import re
from typing import Dict, Any, List
from services.adapters.base import BaseModelAdapter, ToolCallItem

GEMMA4_CALL_REGEX = re.compile(r'(?:<\|tool_call>)?call:([a-zA-Z0-9_]+)\{(.*?)\}(?:<tool_call\|>)?', re.DOTALL)

class Gemma4Adapter(BaseModelAdapter):
	name: str = "gemma4"

	def matches(self, model_name: str) -> bool:
		name = model_name.lower()
		return "gemma4" in name or "gemma-4" in name or "gemma_4" in name

	def is_tool_call_token(self, token: str, accumulated: str) -> bool:
		return "<|tool_call" in accumulated or "<tool_call" in accumulated

	def is_tool_call_completed(self, accumulated: str) -> bool:
		return "<tool_call|>" in accumulated or "</tool_call>" in accumulated

	def extract_tool_calls(
		self,
		native_tool_calls: List[Dict[str, Any]] | None = None,
		text_content: str | None = None
	) -> List[ToolCallItem]:
		items: List[ToolCallItem] = []

		if native_tool_calls:
			for tc in native_tool_calls:
				fn = tc.get("function", {})
				name = fn.get("name", "")
				raw_args = fn.get("arguments", {})
				if isinstance(raw_args, str):
					try:
						args = json.loads(raw_args)
					except Exception:
						args = {}
				elif isinstance(raw_args, dict):
					args = raw_args
				else:
					args = {}

				items.append(ToolCallItem(
					name=name,
					args=args,
					call_id=tc.get("id", "call_1")
				))
			return items

		if text_content:
			match = GEMMA4_CALL_REGEX.search(text_content)
			if match:
				fn_name = match.group(1).strip()
				raw_body = match.group(2).strip()

				cleaned = raw_body.replace('<|"|>', '"')
				cleaned = re.sub(r'([a-zA-Z0-9_]+)\s*:', r'"\1":', cleaned)
				try:
					args = json.loads("{" + cleaned + "}")
				except Exception:
					args = {}

				items.append(ToolCallItem(
					name=fn_name,
					args=args,
					raw_text=match.group(0)
				))

		return items

	def format_tool_response(
		self,
		tool_call: ToolCallItem,
		result: str
	) -> List[Dict[str, Any]]:
		if tool_call.raw_text:
			return [
				{"role": "assistant", "content": tool_call.raw_text},
				{"role": "user", "content": f"<|tool_response>response:{tool_call.name}{{{result}}}<tool_response|>"}
			]

		return [{
			"role": "tool",
			"tool_call_id": tool_call.call_id,
			"name": tool_call.name,
			"content": result
		}]
