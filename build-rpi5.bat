@echo off
setlocal

set TARGET_SVC=%1
if "%TARGET_SVC%"=="" set TARGET_SVC=all

echo ============================================================
echo   COMPILACION PARA RASPBERRY PI 5 (ARM64) -> TAG: RPi5
echo ============================================================
call build.bat %TARGET_SVC% rpi5
