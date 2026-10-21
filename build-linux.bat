@echo off
setlocal

set TARGET_SVC=%1
if "%TARGET_SVC%"=="" set TARGET_SVC=all

echo ============================================================
echo   COMPILACION NATIVA PARA LINUX / PC (AMD64) -> TAG: linux
echo ============================================================
call build.bat %TARGET_SVC% linux
