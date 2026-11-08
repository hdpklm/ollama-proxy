from __future__ import annotations
from typing import List
from backend.adapters.base import BaseModelAdapter

class StandardOpenAIAdapter(BaseModelAdapter):
	name: str = "openai_standard"
	eos_tokens: List[str] = ["<|eot_id|>", "<|end_of_text|>", "</s>"]

	def matches(self, model_name: str) -> bool:
		return True
