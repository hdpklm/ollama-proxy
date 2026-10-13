FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=false \
	UV_LINK_MODE=copy \
	PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.loc[k] ./
RUN uv sync --no-install-project --no-dev

COPY main.py ./

ENV MODELS_DIR=/app/modelos
ENV PYTHONUNBUFFERED=1

EXPOSE 2700

CMD ["uv", "run", "--no-sync", "python", "main.py"]
