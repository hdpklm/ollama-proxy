@echo off
setlocal

cd /d "%~dp0\.."

set TARGET_SVC=%1
if "%TARGET_SVC%"=="" set TARGET_SVC=all

set DOCKER_PLATFORM=linux/amd64
set DOCKER_TAG=linux

echo ============================================================
echo   COMPILACION NATIVA PARA LINUX / PC (AMD64)
echo   Tag: %DOCKER_TAG% - Plataforma: %DOCKER_PLATFORM%
echo   Objetivo: %TARGET_SVC%
echo ============================================================
echo.

if /i "%TARGET_SVC%"=="all" goto build_all

call :build_single "%TARGET_SVC%"
if errorlevel 1 goto error_exit
goto finished

:build_all
call :dispatch_service "ollama-proxy" "."
if errorlevel 1 goto error_exit

call :dispatch_service "interface" "./interface"
if errorlevel 1 goto error_exit

call :dispatch_service "piper-tts" "./dockers/piper"
if errorlevel 1 goto error_exit

call :dispatch_service "vosk-stt" "./dockers/vosk"
if errorlevel 1 goto error_exit

call :dispatch_service "web-tools" "./dockers/web-tools"
if errorlevel 1 goto error_exit

goto finished

:build_single
set SVC=%~1
if /i "%SVC%"=="ollama-proxy" (
	call :dispatch_service "ollama-proxy" "."
	exit /b %errorlevel%
)
if /i "%SVC%"=="proxy" (
	call :dispatch_service "ollama-proxy" "."
	exit /b %errorlevel%
)
if /i "%SVC%"=="interface" (
	call :dispatch_service "interface" "./interface"
	exit /b %errorlevel%
)
if /i "%SVC%"=="piper-tts" (
	call :dispatch_service "piper-tts" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%SVC%"=="piper" (
	call :dispatch_service "piper-tts" "./dockers/piper"
	exit /b %errorlevel%
)
if /i "%SVC%"=="vosk-stt" (
	call :dispatch_service "vosk-stt" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%SVC%"=="vosk" (
	call :dispatch_service "vosk-stt" "./dockers/vosk"
	exit /b %errorlevel%
)
if /i "%SVC%"=="web-tools" (
	call :dispatch_service "web-tools" "./dockers/web-tools"
	exit /b %errorlevel%
)
if /i "%SVC%"=="web" (
	call :dispatch_service "web-tools" "./dockers/web-tools"
	exit /b %errorlevel%
)
echo [ERROR] Servicio desconocido: %SVC%
exit /b 1

:dispatch_service
set NAME=%~1
set CTX=%~2
echo.
echo ------------------------------------------------------------
echo [*] Compilando %NAME%:%DOCKER_TAG% para %DOCKER_PLATFORM%...
echo ------------------------------------------------------------
docker buildx build --platform %DOCKER_PLATFORM% -t %NAME%:%DOCKER_TAG% --load %CTX%
if errorlevel 1 (
	echo [ERROR] Error al compilar %NAME%:%DOCKER_TAG%.
	exit /b 1
)
echo [*] %NAME%:%DOCKER_TAG% compilada con exito.
exit /b 0

:error_exit
echo.
echo [ERROR] La compilacion se detuvo debido a un fallo.
pause
exit /b 1

:finished
echo.
echo ============================================================
echo   COMPILACION LINUX FINALIZADA
echo ============================================================
echo Puedes iniciar los contenedores localmente con:
echo    docker compose up -d
echo.
pause
