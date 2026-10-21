from config import settings
from services.adapters.base import BaseModelAdapter, ToolCallItem
from services.adapters.gemma4 import Gemma4Adapter
from services.adapters.qwen import QwenAdapter
from services.adapters.openai import StandardOpenAIAdapter

ADAPTERS: list[BaseModelAdapter] = [
	Gemma4Adapter(),
	QwenAdapter(),
]
DEFAULT_ADAPTER = StandardOpenAIAdapter()

def get_adapter(model_name: str | None = None) -> BaseModelAdapter:
	target_model = model_name or settings.LLM_MODEL or ""
	for adapter in ADAPTERS:
		if adapter.matches(target_model):
			return adapter
	return DEFAULT_ADAPTER
