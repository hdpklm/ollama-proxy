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


@router.get("/memory/current")
@router.get("/memory/tree/current")
async def get_current_global_memory():
	import time
	import httpx
	from config import settings
	from services.tree_context_manager import TreeContextManager

	tree_cm = TreeContextManager()
	rag_branch = await tree_cm.get_or_create_branch("main")
	rag_tree = rag_branch.get("tree")
	rag_dict = rag_tree.to_dict() if hasattr(rag_tree, "to_dict") else {}
	if rag_dict:
		rag_dict["name"] = "Memoria RAG Jerárquica (Contexto Activo)"
		rag_dict["data"] = f"Rama: {rag_branch.get('name', 'Principal')}, Mensajes activos: {len(rag_branch.get('messages', []))}"

	kv_cache_tree = None
	headers = {}
	if settings.API_KEY:
		headers["Authorization"] = f"Bearer {settings.API_KEY}"

	async with httpx.AsyncClient(timeout=3.0) as client:
		try:
			res = await client.get(f"{settings.LLM_URL}/api/system/cache/tree", headers=headers)
			if res.status_code == 200:
				kv_cache_tree = res.json()
			else:
				res2 = await client.get(f"{settings.LLM_URL}/system/cache/tree", headers=headers)
				if res2.status_code == 200:
					kv_cache_tree = res2.json()
		except Exception:
			pass

	children = {}
	if kv_cache_tree:
		children["kv_cache"] = kv_cache_tree
	if rag_dict:
		children["rag_memory"] = rag_dict

	return {
		"status": "ok",
		"mode": "global_current",
		"tree": {
			"name": "Estado Global de la Memoria (En Vivo / RAM)",
			"data": "Memoria en tiempo real del sistema: KV Cache Radix Tree y Memoria Contextual RAG",
			"updated_at": time.time(),
			"children": children
		}
	}

