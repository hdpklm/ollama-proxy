from __future__ import annotations
from typing import List
from backend.adapters.base import BaseModelAdapter

class QwenAdapter(BaseModelAdapter):
	name: str = "qwen"
	eos_tokens: List[str] = ["<|im_end|>", "<|endoftext|>"]

	def matches(self, model_name: str) -> bool:
		name = (model_name or "").lower()
		return "qwen" in name
