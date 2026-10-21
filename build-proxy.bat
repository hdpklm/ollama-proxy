@echo off
setlocal

set RPI_IP=%1
set RPI_USER=%2

if "%RPI_IP%"=="" set RPI_IP=192.168.1.200
if "%RPI_USER%"=="" set RPI_USER=inibir

echo ============================================================
echo   [OLLAMA-PROXY] Compilando para ARM64 y enviando a RPi5
echo   Destino: %RPI_USER%@%RPI_IP%
echo ============================================================
echo.

echo [1/2] Compilando ollama-proxy:RPi5...
docker buildx build --platform linux/arm64 -t ollama-proxy:RPi5 --load .
if errorlevel 1 (
	echo [!] Error al compilar ollama-proxy:RPi5.
	pause
	exit /b 1
)

echo.
echo [2/2] Enviando ollama-proxy:RPi5 por SSH a la RPi5...
docker save ollama-proxy:RPi5 | ssh %RPI_USER%@%RPI_IP% "docker load"
if errorlevel 1 (
	echo [!] Error al transferir ollama-proxy:RPi5.
	pause
	exit /b 1
)

echo.
echo [3/3] Sincronizando docker-compose.yml con la RPi5...
scp docker-compose.yml %RPI_USER%@%RPI_IP%:/docker/repos/ollama-proxy/docker-compose.yml

echo.
echo [*] ollama-proxy:RPi5 cargada con exito en la RPi5.
echo [*] En la RPi5 ejecuta: docker compose up -d --no-build ollama-proxy
echo.
pause
