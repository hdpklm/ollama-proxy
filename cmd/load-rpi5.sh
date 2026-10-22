#!/bin/bash
# ==============================================================================
# Usage Examples / Ejemplos de Uso:
#
# 1. Default (IP: 192.168.1.116, Port: 5050, Target: all):
#    ./cmd/load-rpi5.sh
#
# 2. Change Server IP (Cambiar IP del server Hub):
#    HUB_IP=192.168.1.200 ./cmd/load-rpi5.sh
#
# 3. Change Port (Cambiar puerto del Hub):
#    HUB_PORT=6000 ./cmd/load-rpi5.sh
#
# 4. Change both IP and Port (Cambiar IP y puerto a la vez):
#    HUB_IP=192.168.1.200 HUB_PORT=6000 ./cmd/load-rpi5.sh
#
# 5. Target specific service with custom IP (Descargar servicio especifico):
#    HUB_IP=192.168.1.200 ./cmd/load-rpi5.sh ollama-proxy
#
# 6. With sudo (la variable debe ir DESPUES de sudo para que no la borre):
#    sudo HUB_IP=100.100.1.236 bash ./cmd/load-rpi5.sh
#    # o con permisos de ejecucion:
#    # chmod +x ./cmd/load-rpi5.sh
#    # sudo HUB_IP=100.100.1.236 ./cmd/load-rpi5.sh
#
# 7. Persistent export in terminal session (Exportar en la sesion actual):
#    export HUB_IP=192.168.1.200
#    export HUB_PORT=5050
#    ./cmd/load-rpi5.sh
# ==============================================================================
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

pull_with_retry() {
	local img="$1"
	local max_retries=3
	local attempt=1
	while [ $attempt -le $max_retries ]; do
		echo "[*] Descargando capas de ${img} (intento ${attempt}/${max_retries})..."
		if docker pull "${img}"; then
			return 0
		fi
		echo "[!] Error temporal en la descarga. Pausando 3 segundos antes de reintentar..."
		sleep 3
		attempt=$((attempt + 1))
	done
	echo "[ERROR] No se pudo descargar ${img} tras ${max_retries} intentos."
	return 1
}

if [ "$TARGET" = "all" ]; then
	SERVICES=("ollama-proxy" "interface" "piper-tts" "vosk-stt" "web-tools")
else
	SERVICES=("$TARGET")
fi

for svc in "${SERVICES[@]}"; do
	echo "------------------------------------------------------------"
	echo "[*] Procesando ${svc}:${TAG}..."
	echo "------------------------------------------------------------"
	pull_with_retry "${HUB_HOST}/${svc}:${TAG}"
	docker tag "${HUB_HOST}/${svc}:${TAG}" "${svc}:${TAG}"
	docker rmi "${HUB_HOST}/${svc}:${TAG}" >/dev/null 2>&1 || true
	echo "[OK] ${svc}:${TAG} lista (eliminado alias ${HUB_HOST})."
	echo ""
	sleep 1
done

# Clean any leftover registry tags
for lingering in $(docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${HUB_HOST}/" || true); do
	docker rmi "$lingering" >/dev/null 2>&1 || true
done

echo "============================================================"
echo "  DESCARGA COMPLETADA (TODOS LOS ALIAS IP:PUERTO ELIMINADOS)"
echo "============================================================"
echo ""
docker images | grep -E "ollama-proxy|interface|piper-tts|vosk-stt|web-tools"
echo ""
echo "Para arrancar el stack completo:"
echo "   IMAGE_TAG=RPi5 docker compose up -d --no-build"
echo ""
