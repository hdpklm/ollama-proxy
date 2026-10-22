@echo off
setlocal
cd /d "%~dp0\.."
uv run --env-file .env uvicorn main:app --host 0.0.0.0 --port 8000
