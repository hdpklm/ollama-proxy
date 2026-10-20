@echo off
setlocal enabledelayedexpansion

set TARGET_SVC=%1

if "%TARGET_SVC%"=="" (
	echo ============================================================
	echo   COMPILACION ARM64 LOCAL EN PC (SIN ENVIO)
	echo ============================================================
	echo.
	echo Selecciona el servicio a compilar (puedes separar por comas, ej: v,p):
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
if "%TARGET_SVC%"=="*" goto build_all
if /i "%TARGET_SVC%"=="all" goto build_all

set "ITEMS=%TARGET_SVC:,= %"

for %%I in (%ITEMS%) do (
	call :dispatch_build "%%~I"
	if errorlevel 1 (
		pause
		exit /b 1
	)
)
goto finished

:build_all
call :build_image "ollama-proxy:latest" "."
if errorlevel 1 exit /b 1
call :build_image "interface:latest" "./interface"
if errorlevel 1 exit /b 1
call :build_image "piper-tts:latest" "./dockers/piper"
if errorlevel 1 exit /b 1
call :build_image "vosk-stt:latest" "./dockers/vosk"
if errorlevel 1 exit /b 1
call :build_image "web-tools:latest" "./dockers/web-tools"
if errorlevel 1 exit /b 1
goto finished

:dispatch_build
set "ITEM=%~1"
if "%ITEM%"=="*" goto build_all
if /i "%ITEM%"=="all" goto build_all
if /i "%ITEM%"=="i" (
	call :build_image "interface:latest" "./interface"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="interface" (
	call :build_image "interface:latest" "./interface"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="p" (
	call :build_image "piper-tts:latest" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="piper" (
	call :build_image "piper-tts:latest" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="piper-tts" (
	call :build_image "piper-tts:latest" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="v" (
	call :build_image "vosk-stt:latest" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="vosk" (
	call :build_image "vosk-stt:latest" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="vosk-stt" (
	call :build_image "vosk-stt:latest" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="o" (
	call :build_image "ollama-proxy:latest" "."
	exit /b %errorlevel%
)
if /i "%ITEM%"=="proxy" (
	call :build_image "ollama-proxy:latest" "."
	exit /b %errorlevel%
)
if /i "%ITEM%"=="ollama-proxy" (
	call :build_image "ollama-proxy:latest" "."
	exit /b %errorlevel%
)
if /i "%ITEM%"=="w" (
	call :build_image "web-tools:latest" "./dockers/web-tools"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="web" (
	call :build_image "web-tools:latest" "./dockers/web-tools"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="web-tools" (
	call :build_image "web-tools:latest" "./dockers/web-tools"
	exit /b %errorlevel%
)

echo [ERROR] Servicio desconocido: %ITEM%
exit /b 1

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
echo Puedes transferir las imagenes a la RPi5 con: send.bat %TARGET_SVC%
echo.
pause
