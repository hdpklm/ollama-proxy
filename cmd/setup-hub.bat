@echo off
setlocal

set REGISTRY_PORT=5050
set CONTAINER_NAME=local-registry

echo ============================================================
echo   LEVANTANDO SERVIDOR DOCKER HUB LOCAL (REGISTRY:2)
echo   Puerto: %REGISTRY_PORT%
echo ============================================================
echo.

docker inspect %CONTAINER_NAME% >nul 2>&1
if errorlevel 1 (
	echo [*] Creando y arrancando contenedor '%CONTAINER_NAME%'...
	docker run -d -p %REGISTRY_PORT%:5000 --restart always --name %CONTAINER_NAME% registry:2
	if errorlevel 1 (
		echo [ERROR] No se pudo iniciar el contenedor '%CONTAINER_NAME%'.
		pause
		exit /b 1
	)
) else (
	echo [*] El contenedor '%CONTAINER_NAME%' ya existe.
	docker inspect -f "{{.State.Running}}" %CONTAINER_NAME% 2>nul | findstr /i "true" >nul
	if errorlevel 1 (
		echo [*] Iniciando '%CONTAINER_NAME%' detenido...
		docker start %CONTAINER_NAME%
	) else (
		echo [OK] El registro ya esta en ejecucion en el puerto %REGISTRY_PORT%.
	)
)

echo.
echo ============================================================
echo   HUB LOCAL DISPONIBLE
echo ============================================================
echo URL local:  http://localhost:%REGISTRY_PORT%/v2/_catalog
echo URL red:    http://192.168.1.116:%REGISTRY_PORT%/v2/_catalog
echo.
pause
