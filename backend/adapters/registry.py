from __future__ import annotations
from backend.adapters.base import BaseModelAdapter
from backend.adapters.gemma4 import Gemma4Adapter
from backend.adapters.qwen import QwenAdapter
from backend.adapters.openai import StandardOpenAIAdapter

ADAPTERS: list[BaseModelAdapter] = [
	Gemma4Adapter(),
	QwenAdapter(),
]
DEFAULT_ADAPTER = StandardOpenAIAdapter()

def get_adapter(model_name: str | None = None) -> BaseModelAdapter:
	target_model = (model_name or "").lower()
	for adapter in ADAPTERS:
		if adapter.matches(target_model):
			return adapter
	return DEFAULT_ADAPTER
