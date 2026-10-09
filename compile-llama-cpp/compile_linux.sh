#!/bin/bash
set -e

cd "$(dirname "$0")"

ARCH=$(uname -m)
OUTPUT_DIR="$(pwd)/output"
mkdir -p "$OUTPUT_DIR"

echo "=================================================="
echo "Compilando llama-cpp-python para Linux ($ARCH)..."
echo "=================================================="

export CMAKE_ARGS="-DGGML_NATIVE=on"

# Use temporary build environment
if command -v uv >/dev/null 2>&1; then
	echo "Usando uv para compilar..."
	rm -rf .tmp_venv
	uv venv .tmp_venv
	source .tmp_venv/bin/activate
	uv pip install --no-binary llama-cpp-python --force-reinstall llama-cpp-python
	
	# Locate generated wheel in uv cache
	WHEEL_PATH=$(find ~/.cache/uv -name "*llama_cpp_python*.whl" -type f -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -n 1 | awk '{print $2}')
	
	if [ -z "$WHEEL_PATH" ] || [ ! -f "$WHEEL_PATH" ]; then
		# Fallback: package with pip wheel if available
		uv pip install wheel
		pip wheel --no-deps llama-cpp-python -w "$OUTPUT_DIR"
	else
		cp "$WHEEL_PATH" "$OUTPUT_DIR/"
	fi
	rm -rf .tmp_venv
else
	echo "Usando pip tradicional para compilar..."
	python3 -m venv .tmp_venv
	source .tmp_venv/bin/activate
	pip install --upgrade pip wheel
	pip wheel --no-deps llama-cpp-python -w "$OUTPUT_DIR"
	rm -rf .tmp_venv
fi

# Locate the output wheel and create an architecture-specific named copy
LATEST_WHEEL=$(ls -t "$OUTPUT_DIR"/*.whl 2>/dev/null | head -n 1)

if [ -n "$LATEST_WHEEL" ] && [ -f "$LATEST_WHEEL" ]; then
	BASENAME=$(basename "$LATEST_WHEEL")
	ARCH_NAME="llama_cpp_python-linux-${ARCH}.whl"
	cp "$LATEST_WHEEL" "$OUTPUT_DIR/$ARCH_NAME"
	
	echo "=================================================="
	echo "Compilacion completada con exito!"
	echo "Archivo original:  $OUTPUT_DIR/$BASENAME"
	echo "Archivo nombrado:  $OUTPUT_DIR/$ARCH_NAME"
	echo "=================================================="
else
	echo "Error: No se encontro el archivo wheel generado en $OUTPUT_DIR"
	exit 1
fi
