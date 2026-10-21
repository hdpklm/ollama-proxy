from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Any, List

@dataclass
class ToolCallItem:
	name: str
	args: Dict[str, Any]
	call_id: str = "call_1"
	raw_text: str | None = None

class BaseModelAdapter(ABC):
	name: str = "base"

	@abstractmethod
	def matches(self, model_name: str) -> bool:
		pass

	def format_system_prompt(self, base_prompt: str, tools: List[Dict[str, Any]] | None = None) -> str:
		return base_prompt

	def is_tool_call_token(self, token: str, accumulated: str) -> bool:
		return False

	def is_tool_call_completed(self, accumulated: str) -> bool:
		return False

	@abstractmethod
	def extract_tool_calls(
		self,
		native_tool_calls: List[Dict[str, Any]] | None = None,
		text_content: str | None = None
	) -> List[ToolCallItem]:
		pass

	@abstractmethod
	def format_tool_response(
		self,
		tool_call: ToolCallItem,
		result: str
	) -> List[Dict[str, Any]]:
		pass
