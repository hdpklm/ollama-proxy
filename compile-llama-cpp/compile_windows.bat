@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set ARCH=%PROCESSOR_ARCHITECTURE%
set OUTPUT_DIR=%~dp0output
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo ==================================================
echo Compilando llama-cpp-python para Windows (%ARCH%)...
echo ==================================================

set CMAKE_ARGS=-DGGML_NATIVE=on

where uv >nul 2>nul
if %ERRORLEVEL% equ 0 (
	echo Usando uv para compilar...
	if exist .tmp_venv rmdir /s /q .tmp_venv
	call uv venv .tmp_venv
	call .tmp_venv\Scripts\activate.bat
	call uv pip install wheel
	call pip wheel --no-deps llama-cpp-python -w "%OUTPUT_DIR%"
	call deactivate
	if exist .tmp_venv rmdir /s /q .tmp_venv
) else (
	echo Usando pip tradicional para compilar...
	if exist .tmp_venv rmdir /s /q .tmp_venv
	python -m venv .tmp_venv
	call .tmp_venv\Scripts\activate.bat
	python -m pip install --upgrade pip wheel
	pip wheel --no-deps llama-cpp-python -w "%OUTPUT_DIR%"
	call deactivate
	if exist .tmp_venv rmdir /s /q .tmp_venv
)

for /f "delims=" %%F in ('dir /b /a-d /o-d "%OUTPUT_DIR%\*.whl" 2^>nul') do (
	set LATEST_WHEEL=%%F
	goto :found
)

echo Error: No se encontro ningun archivo wheel generado en "%OUTPUT_DIR%".
exit /b 1

:found
set ARCH_NAME=llama_cpp_python-windows-%ARCH%.whl
copy /y "%OUTPUT_DIR%\%LATEST_WHEEL%" "%OUTPUT_DIR%\%ARCH_NAME%" >nul

echo ==================================================
echo Compilacion completada con exito!
echo Archivo original:  %OUTPUT_DIR%\%LATEST_WHEEL%
echo Archivo nombrado:  %OUTPUT_DIR%\%ARCH_NAME%
echo ==================================================
