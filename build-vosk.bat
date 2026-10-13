@echo off
setlocal

set RPI_IP=%1
set RPI_USER=%2

if "%RPI_IP%"=="" set RPI_IP=192.168.1.200
if "%RPI_USER%"=="" set RPI_USER=inibir

echo ============================================================
echo   [VOSK-STT] Compilando para ARM64 y enviando a RPi5
echo   Destino: %RPI_USER%@%RPI_IP%
echo ============================================================
echo.

echo [1/2] Compilando vosk-stt:latest...
docker buildx build --platform linux/arm64 -t vosk-stt:latest --load ./dockers/vosk
if errorlevel 1 (
	echo [!] Error al compilar vosk-stt:latest.
	pause
	exit /b 1
)

echo.
echo [2/2] Enviando vosk-stt:latest por SSH a la RPi5...
docker save vosk-stt:latest | ssh %RPI_USER%@%RPI_IP% "docker load"
if errorlevel 1 (
	echo [!] Error al transferir vosk-stt:latest.
	pause
	exit /b 1
)

echo.
echo [3/3] Sincronizando docker-compose.yml con la RPi5...
scp docker-compose.yml %RPI_USER%@%RPI_IP%:/docker/repos/ollama-proxy/docker-compose.yml

echo.
echo [*] vosk-stt:latest cargada con exito en la RPi5.
echo [*] En la RPi5 ejecuta: docker compose up -d --no-build vosk-stt
echo.
pause
