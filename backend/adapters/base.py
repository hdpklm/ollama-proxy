from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Set, Any

class BaseModelAdapter(ABC):
	name: str = "base"
	eos_tokens: List[str] = []

	@abstractmethod
	def matches(self, model_name: str) -> bool:
		pass

	def get_eos_token_ids(self, llm: Any) -> Set[int]:
		eos_set: Set[int] = set()
		if not llm:
			return eos_set

		if hasattr(llm, "token_eos"):
			try:
				val = llm.token_eos()
				if isinstance(val, int) and val >= 0:
					eos_set.add(val)
			except Exception:
				pass

		if hasattr(llm, "tokenize"):
			for tag in self.eos_tokens:
				try:
					toks = list(llm.tokenize(tag.encode("utf-8"), add_bos=False, special=True))
					if len(toks) == 1:
						eos_set.add(toks[0])
				except Exception:
					pass

		return eos_set
