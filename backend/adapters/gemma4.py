from __future__ import annotations
from typing import List
from backend.adapters.base import BaseModelAdapter

class Gemma4Adapter(BaseModelAdapter):
	name: str = "gemma4"
	eos_tokens: List[str] = ["<end_of_turn>", "<eos>"]

	def matches(self, model_name: str) -> bool:
		name = (model_name or "").lower()
		return "gemma4" in name or "gemma-4" in name or "gemma_4" in name or "gemma" in name
