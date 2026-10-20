import io
import os
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Header
from pydantic import BaseModel
import trafilatura
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from pypdf import PdfReader
from duckduckgo_search import DDGS

app = FastAPI(title="Web Tools Service", version="0.1.0")

PARALLEL_API_URL = "https://api.parallel.ai/v1/search"
DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

class SearchRequest(BaseModel):
	query: str
	max_results: int = 5

class ReadRequest(BaseModel):
	url: str

class PdfUrlRequest(BaseModel):
	url: str

@app.get("/health")
def health():
	return {
		"status": "ok",
		"parallel_configured": bool(os.getenv("PARALLEL_API_KEY"))
	}

@app.post("/search")
async def search_endpoint(req: SearchRequest, x_api_key: str | None = Header(None)):
	query = req.query.strip()
	if not query:
		raise HTTPException(status_code=400, detail="Query cannot be empty")

	parallel_key = x_api_key or os.getenv("PARALLEL_API_KEY", "")

	# 1. Try Parallel API if key is available
	if parallel_key:
		try:
			async with httpx.AsyncClient(timeout=15.0) as client:
				resp = await client.post(
					PARALLEL_API_URL,
					headers={
						"Content-Type": "application/json",
						"x-api-key": parallel_key
					},
					json={
						"objective": query,
						"search_queries": [query]
					}
				)
				if resp.status_code == 200:
					data = resp.json()
					raw_results = data.get("results", [])
					formatted = []
					for item in raw_results[:req.max_results]:
						excerpts = item.get("excerpts", [])
						snippet = " ".join(excerpts) if isinstance(excerpts, list) else str(excerpts)
						formatted.append({
							"title": item.get("title", ""),
							"url": item.get("url", ""),
							"snippet": snippet
						})
					return {
						"status": "ok",
						"provider": "parallel",
						"query": query,
						"results": formatted
					}
		except Exception as err:
			print(f"[WebTools] Parallel search error, falling back to DuckDuckGo: {err}")

	# 2. Fallback to DuckDuckGo search
	try:
		with DDGS() as ddgs:
			raw_results = list(ddgs.text(query, max_results=req.max_results))
			formatted = []
			for item in raw_results:
				formatted.append({
					"title": item.get("title", ""),
					"url": item.get("href", item.get("url", "")),
					"snippet": item.get("body", item.get("snippet", ""))
				})
			return {
				"status": "ok",
				"provider": "duckduckgo",
				"query": query,
				"results": formatted
			}
	except Exception as ddg_err:
		raise HTTPException(status_code=502, detail=f"Web search failed: {str(ddg_err)}")

@app.post("/read")
async def read_page_endpoint(req: ReadRequest):
	url = req.url.strip()
	if not url.startswith("http://") and not url.startswith("https://"):
		raise HTTPException(status_code=400, detail="Invalid URL protocol")

	try:
		async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers={"User-Agent": DEFAULT_USER_AGENT}) as client:
			resp = await client.get(url)
			resp.raise_for_status()
			html_text = resp.text

		# Extract title
		soup = BeautifulSoup(html_text, "html.parser")
		page_title = soup.title.string.strip() if soup.title and soup.title.string else url

		# Extract clean content using trafilatura
		extracted_md = trafilatura.extract(
			html_text,
			output_format="markdown",
			include_links=True,
			include_images=False,
			favor_precision=True
		)

		# Fallback to markdownify if trafilatura extracted nothing (e.g., non-article pages)
		if not extracted_md or not extracted_md.strip():
			# Remove script and style tags
			for s in soup(["script", "style", "nav", "footer", "header", "noscript"]):
				s.decompose()
			body = soup.find("body") or soup
			extracted_md = md(str(body), heading_style="ATX", strip=["img"])

		return {
			"status": "ok",
			"url": url,
			"title": page_title,
			"markdown": extracted_md.strip()
		}
	except Exception as err:
		raise HTTPException(status_code=502, detail=f"Failed to fetch and parse URL: {str(err)}")

@app.post("/pdf")
async def parse_pdf_endpoint(file: UploadFile | None = File(None), payload: PdfUrlRequest | None = None):
	pdf_bytes = b""
	filename = "document.pdf"

	if file:
		filename = file.filename or "document.pdf"
		pdf_bytes = await file.read()
	elif payload and payload.url:
		filename = payload.url.split("/")[-1] or "document.pdf"
		async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers={"User-Agent": DEFAULT_USER_AGENT}) as client:
			resp = await client.get(payload.url)
			resp.raise_for_status()
			pdf_bytes = resp.content
	else:
		raise HTTPException(status_code=400, detail="Provide either a PDF file upload or a PDF URL")

	try:
		reader = PdfReader(io.BytesIO(pdf_bytes))
		total_pages = len(reader.pages)
		pages_md = []

		for idx, page in enumerate(reader.pages, start=1):
			text = page.extract_text() or ""
			if text.strip():
				pages_md.append(f"### Página {idx}\n\n{text.strip()}")

		full_markdown = f"# {filename}\n\n" + "\n\n---\n\n".join(pages_md)
		return {
			"status": "ok",
			"filename": filename,
			"pages": total_pages,
			"markdown": full_markdown
		}
	except Exception as pdf_err:
		raise HTTPException(status_code=502, detail=f"Failed to extract PDF: {str(pdf_err)}")

if __name__ == "__main__":
	import uvicorn
	port = int(os.getenv("PORT", "7000"))
	uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
