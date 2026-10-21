@echo off
setlocal

set RPI_IP=%1
set RPI_USER=%2

if "%RPI_IP%"=="" set RPI_IP=192.168.1.200
if "%RPI_USER%"=="" set RPI_USER=inibir

echo ============================================================
echo   [WEB-TOOLS] Compilando para ARM64 y enviando a RPi5
echo   Destino: %RPI_USER%@%RPI_IP%
echo ============================================================
echo.

echo [1/2] Compilando web-tools:RPi5...
docker buildx build --platform linux/arm64 -t web-tools:RPi5 --load ./dockers/web-tools
if errorlevel 1 (
	echo [!] Error al compilar web-tools:RPi5.
	pause
	exit /b 1
)

echo.
echo [2/2] Enviando web-tools:RPi5 por SSH a la RPi5...
docker save web-tools:RPi5 | ssh %RPI_USER%@%RPI_IP% "docker load"
if errorlevel 1 (
	echo [!] Error al transferir web-tools:RPi5.
	pause
	exit /b 1
)

echo.
echo [*] web-tools:RPi5 cargada con exito en la RPi5.
echo [*] En la RPi5 ejecuta: docker compose up -d --no-build web-tools
echo.
pause
