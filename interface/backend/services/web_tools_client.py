import httpx
from config import settings
from services.rag_service import RagService

class WebToolsClient:
	def __init__(self, base_url: str = settings.WEB_TOOLS_URL):
		self.base_url = base_url.rstrip("/")
		self.rag = RagService()

	def _get_search_headers(self) -> dict:
		headers = {"Content-Type": "application/json"}
		if settings.PARALLEL_API_KEY:
			headers["x-api-key"] = settings.PARALLEL_API_KEY
		return headers

	async def search(self, query: str, max_results: int = 5) -> dict:
		cache_key = f"search:{query.strip().lower()}:{max_results}"
		cached = await self.rag.get(cache_key)
		if cached:
			return cached

		url = f"{self.base_url}/search"
		headers = self._get_search_headers()
		payload = {"query": query, "max_results": max_results}

		async with httpx.AsyncClient(timeout=20.0) as client:
			resp = await client.post(url, json=payload, headers=headers)
			resp.raise_for_status()
			data = resp.json()
			await self.rag.set(cache_key, data, ttl_seconds=1800)
			return data

	async def read_url(self, target_url: str) -> dict:
		cache_key = f"page:{target_url.strip()}"
		cached = await self.rag.get(cache_key)
		if cached:
			return cached

		url = f"{self.base_url}/read"
		headers = {"Content-Type": "application/json"}
		payload = {"url": target_url}

		async with httpx.AsyncClient(timeout=30.0) as client:
			resp = await client.post(url, json=payload, headers=headers)
			resp.raise_for_status()
			data = resp.json()
			await self.rag.set(cache_key, data, ttl_seconds=7200)

			# Index into Redis vector store with metadata
			md_text = data.get("markdown", "")
			page_title = data.get("title", target_url)
			if md_text:
				await self.rag.index_document(
					doc_id=f"page:{hash(target_url)}",
					content=md_text[:4000],
					title=page_title,
					url=target_url,
					source="web"
				)

			return data

	async def parse_pdf(self, pdf_bytes: bytes | None = None, pdf_url: str | None = None) -> dict:
		if pdf_url:
			cache_key = f"pdf:{pdf_url.strip()}"
			cached = await self.rag.get(cache_key)
			if cached:
				return cached

		url = f"{self.base_url}/pdf"

		async with httpx.AsyncClient(timeout=45.0) as client:
			if pdf_bytes:
				files = {"file": ("document.pdf", pdf_bytes, "application/pdf")}
				resp = await client.post(url, files=files)
			elif pdf_url:
				headers = {"Content-Type": "application/json"}
				resp = await client.post(url, json={"url": pdf_url}, headers=headers)
			else:
				raise ValueError("Must provide either pdf_bytes or pdf_url")

			resp.raise_for_status()
			data = resp.json()
			if pdf_url:
				await self.rag.set(cache_key, data, ttl_seconds=86400)

				# Index into Redis vector store with metadata
				md_text = data.get("markdown", "")
				filename = data.get("filename", pdf_url)
				if md_text:
					await self.rag.index_document(
						doc_id=f"pdf:{hash(pdf_url)}",
						content=md_text[:4000],
						title=filename,
						url=pdf_url,
						source="pdf"
					)

			return data
