#!/bin/bash
set -e

HUB_IP="${HUB_IP:-192.168.1.116}"
HUB_PORT="${HUB_PORT:-5050}"
HUB_HOST="${HUB_IP}:${HUB_PORT}"
TAG="RPi5"

TARGET="${1:-all}"

echo "============================================================"
echo "  DESCARGA DE IMAGENES DESDE EL HUB LOCAL EN RPI5"
echo "  Servidor Hub: ${HUB_HOST}"
echo "  Objetivo:     ${TARGET}"
echo "============================================================"
echo ""

echo "[*] Comprobando conexion con el Hub local (${HUB_HOST})..."
if ! curl -s --connect-timeout 3 "http://${HUB_HOST}/v2/" >/dev/null; then
	echo "[ERROR] No se pudo conectar al Hub en http://${HUB_HOST}."
	echo "        Verifica que tu PC este encendido y ejecutando setup-hub.bat."
	exit 1
fi
echo "[OK] Hub disponible."
echo ""

if [ "$TARGET" = "all" ]; then
	SERVICES=("ollama-proxy" "interface" "piper-tts" "vosk-stt" "web-tools")
else
	SERVICES=("$TARGET")
fi

for svc in "${SERVICES[@]}"; do
	echo "------------------------------------------------------------"
	echo "[*] Descargando ${svc}:${TAG}..."
	echo "------------------------------------------------------------"
	docker pull "${HUB_HOST}/${svc}:${TAG}"
	docker tag "${HUB_HOST}/${svc}:${TAG}" "${svc}:${TAG}"
	docker rmi "${HUB_HOST}/${svc}:${TAG}" >/dev/null 2>&1 || true
	echo "[OK] ${svc}:${TAG} lista en el sistema."
	echo ""
done

echo "============================================================"
echo "  DESCARGA COMPLETADA"
echo "============================================================"
echo ""
docker images | grep -E "ollama-proxy|interface|piper-tts|vosk-stt|web-tools"
echo ""
echo "Para arrancar el stack completo:"
echo "   IMAGE_TAG=RPi5 docker compose up -d --no-build"
echo ""
