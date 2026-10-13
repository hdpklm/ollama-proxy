@echo off
setlocal

set RPI_IP=%1
set RPI_USER=%2

if "%RPI_IP%"=="" set RPI_IP=192.168.1.200
if "%RPI_USER%"=="" set RPI_USER=inibir

echo ============================================================
echo   [PIPER-TTS] Compilando para ARM64 y enviando a RPi5
echo   Destino: %RPI_USER%@%RPI_IP%
echo ============================================================
echo.

echo [1/2] Compilando piper-tts:latest...
docker buildx build --platform linux/arm64 -t piper-tts:latest --load ./dockers/piper
if errorlevel 1 (
	echo [!] Error al compilar piper-tts:latest.
	pause
	exit /b 1
)

echo.
echo [2/2] Enviando piper-tts:latest por SSH a la RPi5...
docker save piper-tts:latest | ssh %RPI_USER%@%RPI_IP% "docker load"
if errorlevel 1 (
	echo [!] Error al transferir piper-tts:latest.
	pause
	exit /b 1
)

echo.
echo [3/3] Sincronizando docker-compose.yml con la RPi5...
scp docker-compose.yml %RPI_USER%@%RPI_IP%:/docker/repos/ollama-proxy/docker-compose.yml

echo.
echo [*] piper-tts:latest cargada con exito en la RPi5.
echo [*] En la RPi5 ejecuta: docker compose up -d --no-build piper-tts
echo.
pause
