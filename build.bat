@echo off
setlocal enabledelayedexpansion

set TARGET_SVC=%1

if "%TARGET_SVC%"=="" (
	echo ============================================================
	echo   COMPILACION ARM64 LOCAL EN PC (SIN ENVIO)
	echo ============================================================
	echo.
	echo Selecciona el servicio a compilar:
	echo   [1] Todos los servicios (proxy + interface + piper + vosk)
	echo   [2] Solo interface (Web + FastAPI)
	echo   [3] Solo piper-tts (TTS)
	echo   [4] Solo vosk-stt (STT)
	echo   [5] Solo ollama-proxy (Core LLM Proxy)
	echo.
	set /p OPCION="Opcion [1-5]: "
	if "!OPCION!"=="1" set TARGET_SVC=all
	if "!OPCION!"=="2" set TARGET_SVC=interface
	if "!OPCION!"=="3" set TARGET_SVC=piper-tts
	if "!OPCION!"=="4" set TARGET_SVC=vosk-stt
	if "!OPCION!"=="5" set TARGET_SVC=ollama-proxy
)

if "%TARGET_SVC%"=="" set TARGET_SVC=all

if "%TARGET_SVC%"=="all" goto build_all
if "%TARGET_SVC%"=="interface" goto build_interface
if "%TARGET_SVC%"=="piper" set TARGET_SVC=piper-tts
if "%TARGET_SVC%"=="piper-tts" goto build_piper
if "%TARGET_SVC%"=="vosk" set TARGET_SVC=vosk-stt
if "%TARGET_SVC%"=="vosk-stt" goto build_vosk
if "%TARGET_SVC%"=="proxy" set TARGET_SVC=ollama-proxy
if "%TARGET_SVC%"=="ollama-proxy" goto build_proxy

echo [ERROR] Servicio desconocido: %TARGET_SVC%
exit /b 1

:build_all
call :build_image "ollama-proxy:latest" "."
if errorlevel 1 exit /b 1
call :build_image "interface:latest" "./interface"
if errorlevel 1 exit /b 1
call :build_image "piper-tts:latest" "./dockers/piper"
if errorlevel 1 exit /b 1
call :build_image "vosk-stt:latest" "./dockers/vosk"
if errorlevel 1 exit /b 1
goto finished

:build_interface
call :build_image "interface:latest" "./interface"
goto finished

:build_piper
call :build_image "piper-tts:latest" "./dockers/piper"
goto finished

:build_vosk
call :build_image "vosk-stt:latest" "./dockers/vosk"
goto finished

:build_proxy
call :build_image "ollama-proxy:latest" "."
goto finished

:build_image
set IMG_NAME=%~1
set CTX_DIR=%~2
echo.
echo ------------------------------------------------------------
echo Compilando %IMG_NAME% para linux/arm64 desde %CTX_DIR%...
echo ------------------------------------------------------------
docker buildx build --platform linux/arm64 -t %IMG_NAME% --load %CTX_DIR%
if errorlevel 1 (
	echo [ERROR] Error al compilar %IMG_NAME%.
	pause
	exit /b 1
)
echo [*] %IMG_NAME% compilada localmente con exito.
exit /b 0

:finished
echo.
echo ============================================================
echo   COMPILACION LOCAL ARM64 FINALIZADA
echo ============================================================
echo Puedes transferir la imagen a la RPi5 con: send.bat %TARGET_SVC%
echo.
pause
