from fastapi import APIRouter, HTTPException, Query
from services.conversation_logger import conversation_logger

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("/conversations")
async def list_conversations():
	return {
		"conversations": conversation_logger.list_conversations()
	}

@router.get("/conversations/{session_dir}")
async def get_conversation_details(session_dir: str, category: str | None = Query(None)):
	files = conversation_logger.get_conversation_files(session_dir)
	if category:
		files = [f for f in files if f.get("category") == category]
	return {
		"session_dir": session_dir,
		"files": files,
		"total": len(files)
	}

@router.get("/conversations/{session_dir}/{filename}")
async def get_log_file(session_dir: str, filename: str):
	content = conversation_logger.get_file_content(session_dir, filename)
	if not content:
		raise HTTPException(status_code=404, detail="Log file not found")
	return {
		"session_dir": session_dir,
		"filename": filename,
		"content": content
	}

@router.get("/conversations/{session_dir}/tree")
async def get_conversation_tree(session_dir: str):
	tree_data = conversation_logger.get_tree_structure(session_dir)
	return {
		"session_dir": session_dir,
		"tree": tree_data
	}
