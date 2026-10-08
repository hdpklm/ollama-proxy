from fastapi import Header, HTTPException

from backend.config import PROXY_API_KEY


def require_key(authorization: str = Header(default="")):
	if PROXY_API_KEY and authorization != f"Bearer {PROXY_API_KEY}":
		raise HTTPException(status_code=401, detail="invalid api key")
