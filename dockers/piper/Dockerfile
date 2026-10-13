FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

ENV UV_CACHE_DIR=/root/.cache/uv

COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/uv \
	uv pip install --system -r pyproject.toml

COPY main.py ./

ENV MODELS_DIR=/app/modelos
ENV VOICE_NAME=es_ES-sharvard-medium
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["python", "main.py"]
