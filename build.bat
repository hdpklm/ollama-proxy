@echo off
setlocal enabledelayedexpansion

set TARGET_SVC=%1
set TARGET_PLATFORM=%2

if "%TARGET_PLATFORM%"=="" (
	echo ============================================================
	echo   SELECCION DE ARQUITECTURA / DESTINO DE COMPILACION
	echo ============================================================
	echo   [1] Linux / PC local (linux/amd64 - nativo, sin emulador) -> tag: linux
	echo   [2] Raspberry Pi 5 (linux/arm64)                          -> tag: RPi5
	echo.
	set /p PLAT_OPT="Elige plataforma [1=linux, 2=RPi5, por defecto 1]: "
	if "!PLAT_OPT!"=="2" (
		set TARGET_PLATFORM=RPi5
	) else (
		set TARGET_PLATFORM=linux
	)
)

if /i "%TARGET_PLATFORM%"=="rpi5" (
	set DOCKER_PLATFORM=linux/arm64
	set DOCKER_TAG=RPi5
) else if /i "%TARGET_PLATFORM%"=="arm64" (
	set DOCKER_PLATFORM=linux/arm64
	set DOCKER_TAG=RPi5
) else (
	set DOCKER_PLATFORM=linux/amd64
	set DOCKER_TAG=linux
)

if "%TARGET_SVC%"=="" (
	echo.
	echo ============================================================
	echo   COMPILACION DOCKER [%DOCKER_TAG% / %DOCKER_PLATFORM%]
	echo ============================================================
	echo.
	echo Selecciona el servicio a compilar (puedes separar por comas, ej: v,p):
	echo   [*] Todos los servicios (proxy + interface + piper + vosk + web-tools)
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
call :build_image "ollama-proxy" "."
if errorlevel 1 exit /b 1
call :build_image "interface" "./interface"
if errorlevel 1 exit /b 1
call :build_image "piper-tts" "./dockers/piper"
if errorlevel 1 exit /b 1
call :build_image "vosk-stt" "./dockers/vosk"
if errorlevel 1 exit /b 1
call :build_image "web-tools" "./dockers/web-tools"
if errorlevel 1 exit /b 1
goto finished

:dispatch_build
set "ITEM=%~1"
if "%ITEM%"=="*" goto build_all
if /i "%ITEM%"=="all" goto build_all
if /i "%ITEM%"=="i" (
	call :build_image "interface" "./interface"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="interface" (
	call :build_image "interface" "./interface"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="p" (
	call :build_image "piper-tts" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="piper" (
	call :build_image "piper-tts" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="piper-tts" (
	call :build_image "piper-tts" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="v" (
	call :build_image "vosk-stt" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="vosk" (
	call :build_image "vosk-stt" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="vosk-stt" (
	call :build_image "vosk-stt" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="o" (
	call :build_image "ollama-proxy" "."
	exit /b %errorlevel%
)
if /i "%ITEM%"=="proxy" (
	call :build_image "ollama-proxy" "."
	exit /b %errorlevel%
)
if /i "%ITEM%"=="ollama-proxy" (
	call :build_image "ollama-proxy" "."
	exit /b %errorlevel%
)
if /i "%ITEM%"=="w" (
	call :build_image "web-tools" "./dockers/web-tools"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="web" (
	call :build_image "web-tools" "./dockers/web-tools"
	exit /b %errorlevel%
)
if /i "%ITEM%"=="web-tools" (
	call :build_image "web-tools" "./dockers/web-tools"
	exit /b %errorlevel%
)

echo [ERROR] Servicio desconocido: %ITEM%
exit /b 1

:build_image
set BASE_NAME=%~1
set CTX_DIR=%~2
set FULL_TAG=%BASE_NAME%:%DOCKER_TAG%
echo.
echo ------------------------------------------------------------
echo Compilando %FULL_TAG% para %DOCKER_PLATFORM% desde %CTX_DIR%...
echo ------------------------------------------------------------
docker buildx build --platform %DOCKER_PLATFORM% -t %FULL_TAG% --load %CTX_DIR%
if errorlevel 1 (
	echo [ERROR] Error al compilar %FULL_TAG%.
	pause
	exit /b 1
)
echo [*] %FULL_TAG% compilada con exito.
exit /b 0

:finished
echo.
echo ============================================================
echo   COMPILACION FINALIZADA: TAG [%DOCKER_TAG%] (%DOCKER_PLATFORM%)
echo ============================================================
if /i "%DOCKER_TAG%"=="rpi5" (
	echo Puedes transferir las imagenes a la RPi5 con: send.bat %TARGET_SVC%
) else (
	echo Puedes levantar el stack localmente con: docker compose up -d
)
echo.
pause
