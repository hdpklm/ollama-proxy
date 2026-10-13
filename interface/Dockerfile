FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=false \
	UV_LINK_MODE=copy \
	PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	&& rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/uv.loc[k] ./
RUN uv sync --no-install-project --no-dev

COPY backend/ ./
COPY frontend/dist /app/frontend/dist

ENV PORT=8080
ENV HOST=0.0.0.0
ENV FRONTEND_DIST=/app/frontend/dist
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["uv", "run", "--no-sync", "python", "main.py"]
