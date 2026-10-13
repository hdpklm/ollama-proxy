# Stage 1: Build Frontend (Vite + Tailwind + PNPM)
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY frontend/package.json ./
RUN pnpm install

COPY frontend/ ./
RUN pnpm run build

# Stage 2: Python Backend & Static Server using uv
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	&& rm -rf /var/lib/apt/lists/*

ENV UV_CACHE_DIR=/root/.cache/uv

COPY backend/pyproject.toml /app/backend/
RUN --mount=type=cache,target=/root/.cache/uv \
	cd /app/backend && uv pip install --system -r pyproject.toml

COPY backend/ /app/backend/
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV PORT=8080
ENV HOST=0.0.0.0
ENV PYTHONUNBUFFERED=1

WORKDIR /app/backend
EXPOSE 8080

CMD ["python", "main.py"]
