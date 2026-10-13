import re
from typing import AsyncGenerator

class SentenceChunker:
	def __init__(self, min_words: int = 3, max_words: int = 25):
		self.min_words = min_words
		self.max_words = max_words
		self.buffer = ""
		self.delimiters = re.compile(r'([.!?:\n]+)')

	def push_token(self, token: str) -> list[str]:
		self.buffer += token
		chunks = []

		parts = self.delimiters.split(self.buffer)
		if len(parts) > 1:
			i = 0
			while i < len(parts) - 1:
				sentence = parts[i] + parts[i + 1]
				words = sentence.strip().split()
				if len(words) >= self.min_words:
					chunks.append(sentence.strip())
					i += 2
				else:
					if i + 2 < len(parts):
						parts[i + 2] = sentence + parts[i + 2]
						i += 2
					else:
						break
			self.buffer = "".join(parts[i:])

		words = self.buffer.strip().split()
		if len(words) >= self.max_words:
			last_space = self.buffer.rfind(" ")
			if last_space != -1:
				chunks.append(self.buffer[:last_space].strip())
				self.buffer = self.buffer[last_space:].lstrip()

		return chunks

	def flush(self) -> list[str]:
		remaining = self.buffer.strip()
		self.buffer = ""
		if remaining:
			return [remaining]
		return []
