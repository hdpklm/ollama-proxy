import json
import math
import struct
import time
import hashlib
from typing import Any
try:
	import redis.asyncio as aioredis
except ImportError:
	aioredis = None

from config import settings

VECTOR_DIM = 128
INDEX_NAME = "idx:rag"
DOC_PREFIX = "rag:doc:"

def compute_local_embedding(text: str, dim: int = VECTOR_DIM) -> list[float]:
	"""
	Generates a fast, deterministic, unit-normalized vector of dimension `dim`
	from text using subword/character n-grams and hashing.
	"""
	vec = [0.0] * dim
	words = text.lower().split()
	if not words:
		return [1.0 / math.sqrt(dim)] * dim

	for word in words:
		# Hash whole word and 3-grams
		tokens = [word]
		if len(word) >= 3:
			tokens.extend(word[i:i+3] for i in range(len(word) - 2))
		for tok in tokens:
			h = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16)
			idx = h % dim
			sign = 1.0 if (h & 0x100) else -1.0
			vec[idx] += sign

	norm = math.sqrt(sum(x * x for x in vec))
	if norm == 0.0:
		return [1.0 / math.sqrt(dim)] * dim
	return [x / norm for x in vec]

def pack_vector(vec: list[float]) -> bytes:
	return struct.pack(f"{len(vec)}f", *vec)

class RagService:
	def __init__(self, redis_url: str = settings.REDIS_URL):
		self.redis_url = redis_url
		self.client: Any = None
		self._memory_cache: dict[str, tuple[float, Any]] = {}
		self._memory_docs: list[dict] = []
		self._index_initialized = False

	async def _get_client(self) -> Any:
		if self.client is None and self.redis_url:
			try:
				self.client = aioredis.from_url(
					self.redis_url,
					decode_responses=False,
					socket_connect_timeout=2.0
				)
				await self.client.ping()
				await self._ensure_index()
			except Exception:
				self.client = None
		return self.client

	async def _ensure_index(self):
		if not self.client or self._index_initialized:
			return
		try:
			# Check if index already exists
			await self.client.execute_command("FT.INFO", INDEX_NAME)
			self._index_initialized = True
		except Exception:
			# Index does not exist, create it with vector and metadata fields
			try:
				await self.client.execute_command(
					"FT.CREATE", INDEX_NAME,
					"ON", "HASH",
					"PREFIX", "1", DOC_PREFIX,
					"SCHEMA",
					"content", "TEXT",
					"title", "TEXT",
					"url", "TAG",
					"source", "TAG",
					"timestamp", "NUMERIC",
					"vector", "VECTOR", "HNSW", "6",
					"TYPE", "FLOAT32",
					"DIM", str(VECTOR_DIM),
					"DISTANCE_METRIC", "COSINE"
				)
				self._index_initialized = True
			except Exception as e:
				# Index might exist or RediSearch not loaded yet
				if "Index already exists" in str(e):
					self._index_initialized = True

	async def get(self, key: str) -> Any | None:
		client = await self._get_client()
		if client:
			try:
				raw_val = await client.get(key)
				if raw_val:
					return json.loads(raw_val.decode("utf-8"))
			except Exception:
				pass

		if key in self._memory_cache:
			expiry, val = self._memory_cache[key]
			if time.time() < expiry:
				return val
			del self._memory_cache[key]
		return None

	async def set(self, key: str, value: Any, ttl_seconds: int = 3600):
		client = await self._get_client()
		if client:
			try:
				await client.set(key, json.dumps(value).encode("utf-8"), ex=ttl_seconds)
				return
			except Exception:
				pass

		self._memory_cache[key] = (time.time() + ttl_seconds, value)
		if len(self._memory_cache) > 500:
			now = time.time()
			self._memory_cache = {k: (exp, v) for k, (exp, v) in self._memory_cache.items() if exp > now}

	async def index_document(
		self,
		doc_id: str,
		content: str,
		title: str = "",
		url: str = "",
		source: str = "web",
		metadata: dict | None = None
	):
		clean_content = content.strip()
		if not clean_content:
			return

		vec = compute_local_embedding(clean_content, dim=VECTOR_DIM)
		vec_bytes = pack_vector(vec)
		now_ts = int(time.time())

		client = await self._get_client()
		if client:
			try:
				redis_key = f"{DOC_PREFIX}{doc_id}"
				mapping = {
					b"content": clean_content.encode("utf-8"),
					b"title": title.encode("utf-8"),
					b"url": url.encode("utf-8"),
					b"source": source.encode("utf-8"),
					b"timestamp": str(now_ts).encode("utf-8"),
					b"vector": vec_bytes
				}
				if metadata:
					mapping[b"metadata"] = json.dumps(metadata).encode("utf-8")
				await client.hset(redis_key, mapping=mapping)
				return
			except Exception as err:
				print(f"[RAG] Redis hset error: {err}")

		# Fallback in-memory
		self._memory_docs.append({
			"id": doc_id,
			"content": clean_content,
			"title": title,
			"url": url,
			"source": source,
			"timestamp": now_ts,
			"vector": vec,
			"metadata": metadata or {}
		})
		if len(self._memory_docs) > 200:
			self._memory_docs.pop(0)

	async def search_vector(
		self,
		query: str,
		top_k: int = 3,
		filter_source: str | None = None
	) -> list[dict]:
		clean_query = query.strip()
		if not clean_query:
			return []

		query_vec = compute_local_embedding(clean_query, dim=VECTOR_DIM)
		query_bytes = pack_vector(query_vec)

		client = await self._get_client()
		if client:
			try:
				if filter_source:
					q_str = f"(@source:{{{filter_source}}})=>[KNN {top_k} @vector $vec AS score]"
				else:
					q_str = f"*=>[KNN {top_k} @vector $vec AS score]"

				res = await client.execute_command(
					"FT.SEARCH", INDEX_NAME,
					q_str,
					"PARAMS", "2", "vec", query_bytes,
					"SORTBY", "score",
					"DIALECT", "2",
					"RETURN", "6", "content", "title", "url", "source", "timestamp", "score"
				)

				# Redis FT.SEARCH returns [total_count, key1, [f1, v1, f2, v2...], key2, ...]
				results = []
				if res and isinstance(res, (list, tuple)) and len(res) > 1:
					total_matches = res[0]
					idx = 1
					while idx < len(res):
						doc_key = res[idx].decode("utf-8") if isinstance(res[idx], bytes) else str(res[idx])
						doc_fields = res[idx + 1] if idx + 1 < len(res) else []
						doc_data = {"key": doc_key}

						if isinstance(doc_fields, (list, tuple)):
							for f_idx in range(0, len(doc_fields), 2):
								f_name = doc_fields[f_idx].decode("utf-8") if isinstance(doc_fields[f_idx], bytes) else str(doc_fields[f_idx])
								f_val = doc_fields[f_idx + 1].decode("utf-8") if isinstance(doc_fields[f_idx + 1], bytes) else str(doc_fields[f_idx + 1])
								doc_data[f_name] = f_val

						results.append(doc_data)
						idx += 2

				return results
			except Exception as err:
				print(f"[RAG] Redis vector search error: {err}")

		# Fallback memory search
		scored = []
		for doc in self._memory_docs:
			if filter_source and doc.get("source") != filter_source:
				continue
			doc_vec = doc.get("vector", [])
			# Cosine similarity for unit vectors is dot product
			sim = sum(a * b for a, b in zip(query_vec, doc_vec))
			scored.append((sim, doc))

		scored.sort(key=lambda x: x[0], reverse=True)
		return [
			{
				"key": item[1].get("id"),
				"content": item[1].get("content"),
				"title": item[1].get("title"),
				"url": item[1].get("url"),
				"source": item[1].get("source"),
				"score": str(round(1.0 - item[0], 4))
			}
			for item in scored[:top_k]
		]
