@echo off
setlocal enabledelayedexpansion

set TARGET_SVC=%1
set RPI_IP=%2
set RPI_USER=%3

if "%RPI_IP%"=="" set RPI_IP=192.168.1.200
if "%RPI_USER%"=="" set RPI_USER=inibir

if "%TARGET_SVC%"=="" (
	echo ============================================================
	echo   TRANSFERENCIA DIRECTA A RPI5 (STREAM SSH SIN COMPRESION)
	echo   Destino: %RPI_USER%@%RPI_IP%
	echo ============================================================
	echo.
	echo Selecciona el servicio a transferir:
	echo   [*] Todos los servicios (proxy + interface + piper + vosk)
	echo   [i] Solo interface (Web + FastAPI)
	echo   [p] Solo piper-tts (TTS)
	echo   [v] Solo vosk-stt (STT)
	echo   [o] Solo ollama-proxy (Core LLM Proxy)
	echo.
	set /p OPCION="Opcion [*, i, p, v, o]: "
	if "!OPCION!"=="*" set TARGET_SVC=all
	if "!OPCION!"=="1" set TARGET_SVC=all
	if /i "!OPCION!"=="i" set TARGET_SVC=interface
	if "!OPCION!"=="2" set TARGET_SVC=interface
	if /i "!OPCION!"=="p" set TARGET_SVC=piper-tts
	if "!OPCION!"=="3" set TARGET_SVC=piper-tts
	if /i "!OPCION!"=="v" set TARGET_SVC=vosk-stt
	if "!OPCION!"=="4" set TARGET_SVC=vosk-stt
	if /i "!OPCION!"=="o" set TARGET_SVC=ollama-proxy
	if "!OPCION!"=="5" set TARGET_SVC=ollama-proxy
)

if "%TARGET_SVC%"=="" set TARGET_SVC=all
if "%TARGET_SVC%"=="*" set TARGET_SVC=all

if /i "%TARGET_SVC%"=="all" goto send_all
if /i "%TARGET_SVC%"=="i" goto send_interface
if /i "%TARGET_SVC%"=="interface" goto send_interface
if /i "%TARGET_SVC%"=="p" set TARGET_SVC=piper-tts
if /i "%TARGET_SVC%"=="piper" set TARGET_SVC=piper-tts
if /i "%TARGET_SVC%"=="piper-tts" goto send_piper
if /i "%TARGET_SVC%"=="v" set TARGET_SVC=vosk-stt
if /i "%TARGET_SVC%"=="vosk" set TARGET_SVC=vosk-stt
if /i "%TARGET_SVC%"=="vosk-stt" goto send_vosk
if /i "%TARGET_SVC%"=="o" set TARGET_SVC=ollama-proxy
if /i "%TARGET_SVC%"=="proxy" set TARGET_SVC=ollama-proxy
if /i "%TARGET_SVC%"=="ollama-proxy" goto send_proxy

echo [ERROR] Servicio desconocido: %TARGET_SVC%
exit /b 1

:send_all
call :send_image "ollama-proxy:latest"
if errorlevel 1 exit /b 1
call :send_image "interface:latest"
if errorlevel 1 exit /b 1
call :send_image "piper-tts:latest"
if errorlevel 1 exit /b 1
call :send_image "vosk-stt:latest"
if errorlevel 1 exit /b 1
goto finished

:send_interface
call :send_image "interface:latest"
goto finished

:send_piper
call :send_image "piper-tts:latest"
goto finished

:send_vosk
call :send_image "vosk-stt:latest"
goto finished

:send_proxy
call :send_image "ollama-proxy:latest"
goto finished

:send_image
set IMG_NAME=%~1
echo.
echo ------------------------------------------------------------
echo Transfiriendo %IMG_NAME% por stream SSH directo...
echo (Sin compresion, sin temp intermedio en disco, directo a docker load)
echo ------------------------------------------------------------
docker save %IMG_NAME% | ssh %RPI_USER%@%RPI_IP% "docker load"
if errorlevel 1 (
	echo [ERROR] Error al transferir %IMG_NAME%.
	pause
	exit /b 1
)
echo [*] %IMG_NAME% cargada en RPi5 con exito.
exit /b 0

:finished
echo.
echo [*] Sincronizando docker-compose.yml con la RPi5...
scp docker-compose.yml %RPI_USER%@%RPI_IP%:/docker/repos/ollama-proxy/docker-compose.yml
echo.
echo ============================================================
echo   TRANSFERENCIA FINALIZADA
echo ============================================================
echo En la RPi5 ejecuta:
echo.
echo    cd /docker/repos/ollama-proxy
echo    docker compose up -d --no-build
echo.
pause
