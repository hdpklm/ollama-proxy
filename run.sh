#!/bin/bash
cd "$(dirname "$0")"

uv run --env-file .env uvicorn main:app --host 0.0.0.0 --port 8000