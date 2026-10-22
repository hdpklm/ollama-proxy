#!/bin/bash
set -e

# Resolve repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../docker-compose.yml" ]; then
	REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
	REPO_DIR="${SCRIPT_DIR}"
else
	REPO_DIR="$(pwd)"
fi

cd "${REPO_DIR}"

TAG="RPi5"
TARGET="${1:-all}"

echo "============================================================"
echo "  COMPILACION NATIVA EN RASPBERRY PI 5 (ARM64)"
echo "  Directorio raiz: ${REPO_DIR}"
echo "  Tag destino:     ${TAG}"
echo "  Objetivo:        ${TARGET}"
echo "============================================================"
echo ""

build_service() {
	local name="$1"
	local ctx="$2"
	echo "------------------------------------------------------------"
	echo "[*] Compilando ${name}:${TAG} desde ${ctx}..."
	echo "------------------------------------------------------------"
	docker build --network=host -t "${name}:${TAG}" "${ctx}"
	echo "[OK] ${name}:${TAG} compilada con exito."
	echo ""
}

case "${TARGET}" in
	all)
		build_service "ollama-proxy" "."
		build_service "interface" "./interface"
		build_service "piper-tts" "./dockers/piper"
		build_service "vosk-stt" "./dockers/vosk"
		build_service "web-tools" "./dockers/web-tools"
		;;
	ollama-proxy|proxy)
		build_service "ollama-proxy" "."
		;;
	interface)
		build_service "interface" "./interface"
		;;
	piper-tts|piper)
		build_service "piper-tts" "./dockers/piper"
		;;
	vosk-stt|vosk)
		build_service "vosk-stt" "./dockers/vosk"
		;;
	web-tools|web)
		build_service "web-tools" "./dockers/web-tools"
		;;
	*)
		echo "[ERROR] Servicio desconocido: ${TARGET}"
		echo "Opciones validas: all, ollama-proxy, interface, piper-tts, vosk-stt, web-tools"
		exit 1
		;;
esac

echo "============================================================"
echo "  COMPILACION NATIVA COMPLETADA"
echo "============================================================"
echo ""
docker images | grep -E "ollama-proxy|interface|piper-tts|vosk-stt|web-tools"
echo ""
echo "Para arrancar el stack en la RPi5:"
echo "   IMAGE_TAG=RPi5 docker compose up -d --no-build"
echo ""
