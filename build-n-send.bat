@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   DESPLIEGUE MODULAR ARM64 A RASPBERRY PI 5
echo ============================================================
echo.

set RPI_IP=%1
set RPI_USER=%2
set TARGET_SVC=%3

if "%RPI_IP%"=="" (
	set /p RPI_IP="Introduce la IP de la Raspberry Pi 5 [192.168.1.200]: "
)
if "%RPI_IP%"=="" set RPI_IP=192.168.1.200

if "%RPI_USER%"=="" (
	set /p RPI_USER="Introduce el usuario SSH de la RPi5 [inibir]: "
)
if "%RPI_USER%"=="" set RPI_USER=inibir

if not "%TARGET_SVC%"=="" goto process_choice

echo.
echo Selecciona que servicio deseas compilar y transferir:
echo   [1] Todos los servicios (proxy + interface + piper + vosk)
echo   [2] Solo interface (Web + FastAPI)
echo   [3] Solo piper-tts (TTS)
echo   [4] Solo vosk-stt (STT)
echo   [5] Solo ollama-proxy (Core LLM Proxy)
echo.
set /p OPCION="Opcion [1-5]: "

if "%OPCION%"=="2" set TARGET_SVC=interface& goto process_choice
if "%OPCION%"=="3" set TARGET_SVC=piper-tts& goto process_choice
if "%OPCION%"=="4" set TARGET_SVC=vosk-stt& goto process_choice
if "%OPCION%"=="5" set TARGET_SVC=ollama-proxy& goto process_choice
set TARGET_SVC=all

:process_choice
if "%TARGET_SVC%"=="all" goto build_all
if "%TARGET_SVC%"=="ollama-proxy" goto build_proxy
if "%TARGET_SVC%"=="interface" goto build_interface
if "%TARGET_SVC%"=="piper-tts" goto build_piper
if "%TARGET_SVC%"=="vosk-stt" goto build_vosk

:build_all
call :process_image "ollama-proxy:latest" "."
if errorlevel 1 exit /b 1
call :process_image "interface:latest" "./interface"
if errorlevel 1 exit /b 1
call :process_image "piper-tts:latest" "./dockers/piper"
if errorlevel 1 exit /b 1
call :process_image "vosk-stt:latest" "./dockers/vosk"
if errorlevel 1 exit /b 1
goto finished

:build_proxy
call :process_image "ollama-proxy:latest" "."
goto finished

:build_interface
call :process_image "interface:latest" "./interface"
goto finished

:build_piper
call :process_image "piper-tts:latest" "./dockers/piper"
goto finished

:build_vosk
call :process_image "vosk-stt:latest" "./dockers/vosk"
goto finished

:process_image
set IMG_NAME=%~1
set CTX_DIR=%~2
echo.
echo ------------------------------------------------------------
echo [1/2] Compilando %IMG_NAME% para linux/arm64 desde %CTX_DIR%...
echo ------------------------------------------------------------
docker buildx build --platform linux/arm64 -t %IMG_NAME% --load %CTX_DIR%
if errorlevel 1 (
	echo [!] Error al compilar %IMG_NAME%. Abortando.
	pause
	exit /b 1
)

echo.
echo [2/2] Enviando %IMG_NAME% a la RPi5 (%RPI_USER%@%RPI_IP%)...
docker save %IMG_NAME% | ssh %RPI_USER%@%RPI_IP% "docker load"
if errorlevel 1 (
	echo [!] Error al transferir %IMG_NAME% por SSH. Abortando.
	pause
	exit /b 1
)
echo [*] %IMG_NAME% cargada con exito en la RPi5.
echo.
exit /b 0

:finished
echo.
echo [*] Sincronizando docker-compose.yml con la RPi5...
scp docker-compose.yml %RPI_USER%@%RPI_IP%:/docker/repos/ollama-proxy/docker-compose.yml
echo.
echo ============================================================
echo   PROCESO COMPLETADO
echo ============================================================
echo En la RPi5 puedes encender los contenedores con:
echo.
echo    cd /docker/repos/ollama-proxy
echo    docker compose up -d --no-build
echo.
echo ============================================================
pause
