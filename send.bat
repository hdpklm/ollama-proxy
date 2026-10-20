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
	echo Selecciona el servicio a transferir (puedes separar por comas, ej: v,p):
	echo   [*] Todos los servicios (proxy + interface + piper + vosk)
	echo   [i] Solo interface (Web + FastAPI)
	echo   [p] Solo piper-tts (TTS)
	echo   [v] Solo vosk-stt (STT)
	echo   [o] Solo ollama-proxy (Core LLM Proxy)
	echo   [w] Solo web-tools (Search, Reader & PDF)
	echo.
	set /p OPCION="Opcion [*, i, p, v, o, w o separados por comas]: "
	if "!OPCION!"=="" set TARGET_SVC=all
	if "!OPCION!"=="*" set TARGET_SVC=all
	if "!OPCION!"=="1" set TARGET_SVC=all
	if not defined TARGET_SVC set TARGET_SVC=!OPCION!
)

if "%TARGET_SVC%"=="" set TARGET_SVC=all
if "%TARGET_SVC%"=="*" goto send_all
if /i "%TARGET_SVC%"=="all" goto send_all

set "ITEMS=%TARGET_SVC:,= %"

for %%I in (%ITEMS%) do (
	call :dispatch_send "%%~I"
	if errorlevel 1 (
		pause
		exit /b 1
	)
)
goto finished

:send_all
call :send_image "ollama-proxy:latest"
if errorlevel 1 exit /b 1
call :send_image "interface:latest"
if errorlevel 1 exit /b 1
call :send_image "piper-tts:latest"
if errorlevel 1 exit /b 1
call :send_image "vosk-stt:latest"
if errorlevel 1 exit /b 1
call :send_image "web-tools:latest"
if errorlevel 1 exit /b 1
goto finished

:dispatch_send
set "ITEM=%~1"
if "%ITEM%"=="*" goto send_all
if /i "%ITEM%"=="all" goto send_all
if /i "%ITEM%"=="i" (
	call :send_image "interface:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="interface" (
	call :send_image "interface:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="p" (
	call :send_image "piper-tts:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="piper" (
	call :send_image "piper-tts:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="piper-tts" (
	call :send_image "piper-tts:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="v" (
	call :send_image "vosk-stt:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="vosk" (
	call :send_image "vosk-stt:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="vosk-stt" (
	call :send_image "vosk-stt:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="o" (
	call :send_image "ollama-proxy:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="proxy" (
	call :send_image "ollama-proxy:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="ollama-proxy" (
	call :send_image "ollama-proxy:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="w" (
	call :send_image "web-tools:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="web" (
	call :send_image "web-tools:latest"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="web-tools" (
	call :send_image "web-tools:latest"
	exit /b %errorlevel%
)

echo [ERROR] Servicio desconocido: %ITEM%
exit /b 1

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
echo ============================================================
echo   TRANSFERENCIA FINALIZADA
echo ============================================================
echo En la RPi5 ejecuta:
echo.
echo    cd /docker/repos/ollama-proxy
echo    docker compose up -d --no-build
echo.
pause
