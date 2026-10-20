from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from services.web_tools_client import WebToolsClient

router = APIRouter(prefix="/api/tools", tags=["tools"])
web_tools_client = WebToolsClient()

class SearchPayload(BaseModel):
	query: str
	max_results: int = 5

class ReadPayload(BaseModel):
	url: str

class PdfPayload(BaseModel):
	url: str | None = None

@router.post("/search")
async def handle_search(payload: SearchPayload):
	try:
		return await web_tools_client.search(payload.query, max_results=payload.max_results)
	except Exception as err:
		raise HTTPException(status_code=502, detail=f"Search service error: {str(err)}")

@router.post("/read")
async def handle_read(payload: ReadPayload):
	try:
		return await web_tools_client.read_url(payload.url)
	except Exception as err:
		raise HTTPException(status_code=502, detail=f"Web reader service error: {str(err)}")

@router.post("/pdf")
async def handle_pdf(file: UploadFile | None = File(None), url: str | None = None):
	try:
		if file:
			pdf_bytes = await file.read()
			return await web_tools_client.parse_pdf(pdf_bytes=pdf_bytes)
		elif url:
			return await web_tools_client.parse_pdf(pdf_url=url)
		else:
			raise HTTPException(status_code=400, detail="Provide a PDF file or URL")
	except HTTPException:
		raise
	except Exception as err:
		raise HTTPException(status_code=502, detail=f"PDF extraction service error: {str(err)}")
