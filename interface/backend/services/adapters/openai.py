import json
import re
from typing import Dict, Any, List
from services.adapters.base import BaseModelAdapter, ToolCallItem

TOOL_CALL_REGEX = re.compile(r'<tool_call>\s*({.*?})\s*</tool_call>', re.DOTALL)

class StandardOpenAIAdapter(BaseModelAdapter):
	name: str = "openai"

	def matches(self, model_name: str) -> bool:
		return True

	def is_tool_call_token(self, token: str, accumulated: str) -> bool:
		return "<tool_call" in accumulated

	def is_tool_call_completed(self, accumulated: str) -> bool:
		return "</tool_call>" in accumulated

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
			match = TOOL_CALL_REGEX.search(text_content)
			if match:
				try:
					data = json.loads(match.group(1).strip())
					if isinstance(data, dict) and "name" in data:
						raw_args = data.get("arguments", {})
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
							name=data["name"],
							args=args,
							raw_text=match.group(0)
						))
				except Exception:
					pass

		return items

	def format_tool_response(
		self,
		tool_call: ToolCallItem,
		result: str
	) -> List[Dict[str, Any]]:
		if tool_call.raw_text:
			return [
				{"role": "assistant", "content": tool_call.raw_text},
				{"role": "user", "content": f"[Resultado de herramienta {tool_call.name}]:\n{result}"}
			]

		return [{
			"role": "tool",
			"tool_call_id": tool_call.call_id,
			"name": tool_call.name,
			"content": result
		}]
