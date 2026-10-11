FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 \
	python3-venv \
	libgomp1 \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=false \
	UV_LINK_MODE=copy

WORKDIR /app

COPY pyproject.toml uv.loc[k] ./
RUN uv sync --no-install-project --no-dev

COPY compile-llama-cpp ./compile-llama-cpp
RUN ARCH=$(uname -m) && \
	CUSTOM_WHEEL=$(ls /app/compile-llama-cpp/output/*${ARCH}*.whl 2>/dev/null | head -n 1 || true) && \
	if [ -n "$CUSTOM_WHEEL" ] && [ -f "$CUSTOM_WHEEL" ]; then \
		echo "Found custom compiled wheel for $ARCH: $CUSTOM_WHEEL. Installing..."; \
		uv pip install --no-build "$CUSTOM_WHEEL"; \
	else \
		echo "No custom compiled wheel for $ARCH in compile-llama-cpp/output. Using official precompiled wheel."; \
	fi

COPY backend ./backend
COPY main.py ./

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
