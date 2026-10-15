

### 📝 Registro: [v0.2.0] - Implementacion de Scheduler con Interrupcion por Token via llama-cpp-python
- **date-time**: 2026-10-08 20:45:00
- **Problema**:
	- El proxy anterior cancelaba la conexion HTTP upstream hacia Ollama al llegar una peticion prioritaria y reiniciaba la generacion desde cero concatenando el texto parcial, lo que provocaba degradacion de rendimiento, sobrecarga de memoria y fallos en hardware limitado (Raspberry Pi 5 / entornos CPU).
- **Causa**:
	- Servidores genericos externos como Ollama no exponen una API de pausa/reanudacion cooperativa a nivel de token. La cancelacion de la conexion cerraba el contexto y forzaba una reevaluacion completa.
- **Solución**:
	- Se integro `llama-cpp-python` directamente en el proxy (`LlamaEngine` en `backend/engine.py`), manteniendo el modelo base cargado en memoria de solo lectura.
	- Se implemento el planificador con interrupcion por token (`Scheduler` en `backend/scheduler.py`): al detectar una peticion urgente (`priority: True`), el generador de baja prioridad detiene el stream en el limite del token actual liberando la CPU al 100% para resolver la tarea urgente, y luego se reanuda enviando los tokens restantes desde el texto acumulado sin cortar nunca la conexion SSE del cliente ni reiniciar desde cero.
	- Se agregaron endpoints compatibles tanto con OpenAI (`/v1/chat/completions`, `/v1/completions`, `/v1/models`) como nativos documentados (`/api/generate` con estimacion de RAM KV Cache).

### 📝 Registro: [v0.2.1] - Correccion de reanudacion continua sin repeticion de respuesta
- **date-time**: 2026-10-08 21:05:00
- **Problema**:
	- Al pausar una tarea de baja prioridad por una peticion urgente y reanudarla posteriormente, el modelo comenzaba a generar texto nuevamente desde el encabezado inicial (`## El Imperio...`) en lugar de continuar exactamente en la palabra donde se detuvo.
- **Causa**:
	- Al pasar `messages.append({"role": "assistant", "content": job.partial})` a `create_chat_completion`, la plantilla de chat del modelo formateaba el mensaje del asistente como un turno completado y cerrado (`<turn|>`), provocando que el modelo iniciara un nuevo turno de respuesta desde cero.
- **Solución**:
	- Se refactorizo `LlamaEngine` para convertir el historial de chat a prompt base inicial una sola vez (`job.prompt`).
	- Al reanudar la inferencia, se evalua el prompt continuo directo `job.prompt + job.partial` mediante completado en crudo (`llm(full_prompt, stream=True)`), permitiendo al modelo predecir el token inmediatamente consecutivo sin repetir texto ni reiniciar la estructura.

### 📝 Registro: [v0.2.2] - Pausa real in-situ de generador llama-cpp mediante save_state y load_state
- **date-time**: 2026-10-08 21:14:00
- **Problema**:
	- Al entrar una peticion urgente, la tarea de baja prioridad rompia el generador y al terminar la urgente comenzaba una nueva llamada de inferencia evaluando el prompt y texto previo, en lugar de mantener la sesion en pausa real y continuar la marcha sin reiniciar el generador.
- **Causa**:
	- `llama.cpp` utiliza un unico contexto de KV-Cache. Si no se preserva explicitamente el estado del contexto de inferencia, una tarea urgente sobreescribe las posiciones del KV-Cache.
- **Solución**:
	- Se implemento congelacion in-situ del generador (`save_state()`): al detectar preemption, el generador de baja prioridad no sale de su bucle ni se destruye; guarda su estado exacto de KV-Cache en memoria RAM y se congela temporalmente.
	- La tarea urgente se ejecuta de inmediato al 100% de CPU.
	- Al finalizar la tarea urgente, se restaura el estado previo (`load_state(state)`) y el generador de baja prioridad continua en el mismo bucle llamando al siguiente token (`next()`) sin reiniciar llamadas ni reevaluar tokens previos.

### 📝 Registro: [v0.3.0] - Implementacion de Strict Preemptive Token Scheduler con Contextos Duales
- **date-time**: 2026-10-08 21:34:00
- **Problema**:
	- Se requeria implementar el planificador estricto por token en un unico bucle `while True` con prioridad absoluta para la tarea urgente, evitando la necesidad de serializar estados de contexto (`save_state`/`load_state`) o suspender hilos con esperas complejas.
- **Causa**:
	- Compartir un solo contexto de memoria en el modelo provocaba conflictos si dos streams intentaban avanzar concurrentemente.
- **Solución**:
	- Se desacoplaron dos instancias de contexto (`llm_high` y `llm_low`) en `LlamaEngine`, las cuales comparten los mismos pesos en memoria física mediante `mmap` sin duplicar el peso del modelo.
	- Se implemento el bucle central en `Scheduler`: en cada tick se evalua si hay peticion pendiente en `ctx_alta` (dedicando el 100% de la CPU hasta finalizarla); en caso contrario avanza 1 token en `ctx_baja`; y si ambas estan inactivas duerme 10 ms.
	- La interrupcion ocurre de forma natural a nivel de 1 token sin reiniciar ni alterar la generacion en curso de la baja prioridad.

### 📝 Registro: [v0.3.1] - Generacion de README y Documentacion de Despliegue
- **date-time**: 2026-10-08 21:46:00
- **Problema**:
	- Ausencia de guia completa de instalacion, arranque, obtencion directa de modelos GGUF sin Ollama y analisis de rendimiento en Docker.
- **Causa**:
	- El repositorio requeria documentacion de referencia para usuarios y administradores sobre el scheduler preventivo y las dependencias de ejecucion.
- **Solución**:
	- Creacion de `README.md` documentando instalacion con uv, configuracion de variables `.env`, endpoints compatibles y comandos de descarga GGUF desde Hugging Face.

### 📝 Registro: [v0.3.2] - Contexto de Alta Prioridad Configurable (N_CTX_HIGH)
- **date-time**: 2026-10-08 21:54:00
- **Problema**:
	- La ventana de contexto de alta prioridad estaba limitada rígidamente a 512 tokens en `backend/engine.py`, impidiendo respuestas largas en peticiones urgentes.
- **Causa**:
	- `llm_high` inicializaba `n_ctx=512` de forma estática en lugar de permitir su parametrización por entorno.
- **Solución**:
	- Exposición del parámetro `N_CTX_HIGH` en `backend/config.py` y `.env` e inicialización dinámica de `llm_high` con dicho valor.

### 📝 Registro: [v0.3.3] - Guia Detallada de Compilacion Nativa RPi5 en README
- **date-time**: 2026-10-08 23:23:00
- **Problema**:
	- Errores de ejecucion en Raspberry Pi 5 por ausencia de dependencias (`uv: command not found`, `No virtual environment found`) y dudas sobre tiempos de espera en tarjetas MicroSD.
- **Causa**:
	- Raspberry Pi OS no incluye `uv` de serie y requiere inicializar un entorno virtual explícito antes de compilar C++ con aceleración de hardware.
- **Solución**:
	- Inclusion de seccion paso a paso en `README.md` cubriendo instalacion de `build-essential`, `cmake`, instalacion de `uv`, creacion de venv, compilacion nativa con notas sobre swap/MicroSD e instalacion de librerias del proxy.

### 📝 Registro: [v0.3.4] - Configuracion Condicional de Binario RPi5 en pyproject.toml
- **date-time**: 2026-10-08 23:45:00
- **Problema**:
	- Necesidad de automatizar la instalacion del wheel optimizado de `llama-cpp-python` para Raspberry Pi 5 sin romper compatibilidad en Windows u otras arquitecturas.
- **Causa**:
	- La definicion de dependencias requería selectores condicionales según plataforma y arquitectura (PEP 508 / uv sources).
- **Solución**:
	- Incorporacion de `[tool.uv.sources]` en `pyproject.toml` con marker `sys_platform == 'linux' and platform_machine == 'aarch64'` apuntando a GitHub Release y fallback automático a PyPI estándar en el resto de plataformas.

### 📝 Registro: [v0.4.0] - Medicion y Visualizacion de Tokens por Segundo (Prompt y Generacion)
- **date-time**: 2026-10-09 00:25:00
- **Problema**:
	- Ausencia de medicion precisa de tokens por segundo tanto para la fase de evaluacion de prompt (prefill t/s) como de generacion de texto (decode t/s).
- **Causa**:
	- `backend/job.py`, `backend/scheduler.py` y `backend/responses.py` no registraban las marcas de tiempo entre primer token y finalizacion ni exponian metricas de tps en respuestas JSON/SSE.
- **Solución**:
	- Incorporacion de campos de medicion temporal en `Job` y calculo automatico en `Scheduler._token_loop`.
	- Exposicion de `prompt_eval_tokens_per_second` y `generation_tokens_per_second` en `usage` (OpenAI), SSE streaming chunks y endpoint `/api/generate`.
	- Actualizacion de `test_win/normal.py` y `test_win/urgente.py` para calcular y mostrar estadisticas detalladas tanto en cliente como en servidor.

### 📝 Registro: [v0.4.1] - Exactitud en API OpenAI con Claves prompt_token_s y generate_token_s
- **date-time**: 2026-10-09 00:27:00
- **Problema**:
	- Requerimiento de compatibilidad estricta con API OpenAI manteniendo los nombres exactos de campos solicitados: `priority`, `prompt_token_s`, `generate_token_s` y prefijo `chatcmpl-`.
- **Causa**:
	- Las claves de metricas tenian nombres largos en lugar de exponer las claves exactas requeridas por el cliente.
- **Solución**:
	- En `backend/responses.py` se estructuro `usage` con `prompt_token_s`, `generate_token_s`, `prompt_tokens`, `completion_tokens` y `total_tokens`.
	- En streaming SSE se emite el chunk final con `choices: []` y el objeto `usage` compatible con `stream_options` de OpenAI.
	- Actualizacion de `test_win/normal.py` y `test_win/urgente.py` para leer directamente estas claves.

### 📝 Registro: [v0.4.2] - Parametro fast por Peticion, Flash Attention y Guia de Overclock
- **date-time**: 2026-10-09 01:00:00
- **Problema**:
	- Necesidad de permitir optimizaciones de maxima velocidad bajo demanda por peticion sin afectar la precision del resto de consultas, documentar overclock seguro en RPi5 y procedimientos de recuperacion.
- **Causa**:
	- El muestreo multinomial por defecto añade computo innecesario cuando solo se busca velocidad, y no existia documentacion clara de overclock seguro.
- **Solución**:
	- Incorporacion del flag `"fast": true` en JSON de peticiones para activar muestreo voraz (greedy decode `top_k=1, temp=0`).
	- Activacion de `flash_attn=True` en `LlamaEngine` para optimizar calculos de atencion.
	- Documentacion completa en `README.md` del parametro `fast`, ajuste de gobernador en RAM, overclock en `/boot/firmware/config.txt` y restauracion en caso de fallo (via PC o hardware safe mode).

### 📝 Registro: [v0.4.3] - Correccion de Dockerfile para Despliegue con Volúmenes
- **date-time**: 2026-10-09 15:45:00
- **Problema**:
	- `Dockerfile` solo copiaba `*.py` de la raíz omitiendo el paquete `backend/`, impidiendo la ejecución en contenedor Docker.
- **Causa**:
	- Patrón de copia incompleto en la capa de aplicación de Dockerfile.
- **Solución**:
	- Modificación de `Dockerfile` para copiar explícitamente `backend/` y `main.py`, manteniendo montaje de volúmenes de modelos externos en solo lectura.

### 📝 Registro: [v0.4.4] - Creacion de docker-compose.yml con Montaje de Modelos
- **date-time**: 2026-10-09 15:51:00
- **Problema**:
	- Ausencia de configuracion declarativa Docker Compose para levantar el proxy y mapear los volumenes del modelo sin comandos largos de consola.
- **Causa**:
	- Se dependia de instrucciones manuales de `docker run` propensas a errores en rutas y variables de entorno.
- **Solución**:
	- Creacion de `docker-compose.yml` con mapeo de volumenes en modo solo lectura (`/usr/share/ollama/.ollama/models/blobs` y `./modelos`), lectura de `.env` y exposicion del puerto 8000.
	- Documentacion de comandos de ciclo de vida (`docker compose up -d --build`, `logs -f`, `down`) en `README.md`.

### 📝 Registro: [v0.4.5] - Optimizacion Ligera de Dockerfile para RPi5 sin Compiladores
- **date-time**: 2026-10-09 16:05:00
- **Problema**:
	- Intentar compilar en Dockerfile con `build-essential` consumia exceso de RAM en maquinas con limites estrictos y aumentaba el tamaño de la imagen en +800 MB innecesariamente para la SD de la Raspberry Pi.
- **Causa**:
	- Se añadian herramientas de compilacion innecesarias dado que para la arquitectura destino (RPi 5 / ARM64) ya existe el wheel precompilado en GitHub Releases.
- **Solución**:
	- Eliminacion de paquetes de compilacion del Dockerfile, manteniendo la imagen en modo ultraligero (~180 MB) donde `uv sync` descarga directamente el wheel `.whl` optimizado en 2 segundos.

### 📝 Registro: [v0.5.0] - Scripts Automatizados de Compilacion de Wheels (compile-llama-cpp)
- **date-time**: 2026-10-09 16:09:00
- **Problema**:
	- Ausencia de scripts reproducibles para generar y empaquetar binarios wheels (`.whl`) de `llama-cpp-python` optimizados nativamente según la arquitectura de hardware.
- **Causa**:
	- La compilacion dependia de comandos manuales en consola sin nomenclatura estandarizada por plataforma ni carpeta dedicada de salida.
- **Solución**:
	- Creacion del modulo `compile-llama-cpp/` con `compile_linux.sh` y `compile_windows.bat`.
	- Deteccion automatica de arquitectura (`uname -m` en Linux, `%PROCESSOR_ARCHITECTURE%` en Windows), aislamiento en entornos temporales y copia en `output/` con nombres de arquitectura (`llama_cpp_python-linux-{ARCH}.whl` y `llama_cpp_python-windows-{ARCH}.whl`).

### 📝 Registro: [v0.5.2] - Correccion de copia de directorio compile-llama-cpp en Dockerfile
- **date-time**: 2026-10-09 16:47:00
- **Problema**:
- `docker compose build` fallaba en la Raspberry Pi 5 con el error `"/compile-llama-cpp/output": not found` al clonar limpiamente el repositorio.
- **Causa**:
- La carpeta `output/` esta excluida en `.gitignore` y no existe inicialmente en un clon limpio, por lo que una directiva `COPY compile-llama-cpp/output` fallaba al calcular el checksum de BuildKit.
- **Solución**:
- Se modifico la directiva a `COPY compile-llama-cpp ./compile-llama-cpp`. El directorio padre siempre existe en el repositorio, permitiendo compilar la imagen sin errores independientemente de si el usuario ha generado o no wheels previamente.

### 📝 Registro: [v0.5.3] - Desactivacion de compilacion de bytecode Python en Dockerfile
- **date-time**: 2026-10-09 18:01:00
- **Problema**:
- Durante `docker compose up -d --build` en la Raspberry Pi 5, `uv sync` fallaba con `Python startup timed out (60s)` al intentar precompilar los archivos `.py` a bytecode (`.pyc`).
- **Causa**:
- La variable de entorno `UV_COMPILE_BYTECODE=1` forzaba la invocacion concurrente de subprocesos Python para compilar 888 archivos `.py`, lo que provocaba contencion de I/O en la tarjeta MicroSD y superaba el tiempo maximo de espera (timeout de 60s).
- **Solución**:
- Se configuro `UV_COMPILE_BYTECODE=0` y se añadio `--no-compile-bytecode` en el comando `uv sync` de `Dockerfile`, evitando llamadas innecesarias y acelerando el tiempo de construccion de la imagen.

### 📝 Registro: [v0.5.4] - Correccion de sintaxis booleana para UV_COMPILE_BYTECODE en Dockerfile
- **date-time**: 2026-10-09 20:05:00
- **Problema**:
- Al intentar desactivar la compilacion de bytecode en la Raspberry Pi 5, `uv sync` fallo con `error: the argument '--no-compile-bytecode' cannot be used with '--compile-bytecode'` al no existir dicha bandera en CLI.
- **Causa**:
- La imagen base de `uv` define `ENV UV_COMPILE_BYTECODE=1`. Para desactivar la compilacion de bytecode en `uv`, no existe un argumento `--no-compile-bytecode` en CLI, sino que se debe sobreescribir la variable de entorno booleana con `UV_COMPILE_BYTECODE=false`.
- **Solución**:
- Se elimino la bandera invalida de la llamada `uv sync` en `Dockerfile` y se configuro estrictamente `ENV UV_COMPILE_BYTECODE=false`, desactivando la precompilacion de bytecode de forma nativa sin errores de parser.

### 📝 Registro: [v0.5.5] - Restauracion de wheel compilado RPi5 para linux aarch64
- **date-time**: 2026-10-10 01:07:00
- **Problema**:
- En Docker en la Raspberry Pi 5 se estaba descargando la rueda oficial generica de abetlen en lugar de la version compilada optimizada para RPi5, reduciendo la velocidad de 6.56 t/s a 5.66 t/s.
- **Causa**:
- La entrada `linux and aarch64` en `pyproject.toml` habia sido sustituida por el wheel oficial manylinux en lugar de la release de GitHub generada para RPi5.
- **Solución**:
- Se restauro la fuente de `llama-cpp-python` para `sys_platform == 'linux' and platform_machine == 'aarch64'` apuntando a `https://github.com/hdpklm/ollama-proxy/releases/download/v0.3.36-rpi5/llama_cpp_python-0.3.36-py3-none-linux_aarch64.whl`, permitiendo que Docker en RPi5 detecte la arquitectura y descargue el wheel optimizado sin pasar argumentos manuales.

### 📝 Registro: [v0.5.6] - Incorporacion de libreria de runtime OpenMP (libgomp1) en Dockerfile
- **date-time**: 2026-10-10 01:44:00
- **Problema**:
- El contenedor fallaba en el arranque con `RuntimeError: Failed to load shared library '/app/.venv/.../libllama.so': libgomp.so.1: cannot open shared object file: No such file or directory`.
- **Causa**:
- El wheel nativo compilado en la Raspberry Pi 5 utiliza paralelismo OpenMP para acelerar el procesamiento en los 4 cores de la CPU. La imagen base bookworm-slim no incluye la libreria de enlace dinamico en tiempo de ejecucion `libgomp.so.1`.
- **Solución**:
- Se añadio la instalacion del paquete ligero de runtime `libgomp1` mediante apt-get sin compiladores en `Dockerfile` (`--no-install-recommends libgomp1`), permitiendo la carga exitosa de la libreria C++ nativa `libllama.so`.

### 📝 Registro: [v0.5.7] - Actualizacion de imagen base a Ubuntu 24.04 (Noble) por version GLIBC 2.38
- **date-time**: 2026-10-10 02:07:00
- **Problema**:
- El contenedor fallaba al iniciar Uvicorn con `RuntimeError: Failed to load shared library 'libllama.so': /lib/aarch64-linux-gnu/libc.so.6: version 'GLIBC_2.38' not found`.
- **Causa**:
- El binario `libllama.so` compilado nativamente en la Raspberry Pi 5 requiere la version de GNU C Library 2.38 (GLIBC 2.38). La imagen base anterior (`debian:bookworm-slim`) solo dispone de GLIBC 2.36.
- **Solución**:
- Se actualizo la imagen base a `ubuntu:24.04` (que incorpora GLIBC 2.39 retrocompatible con 2.38), instalando `python3`, `python3-venv`, `libgomp1` e importando el binario oficial de `uv` (`ghcr.io/astral-sh/uv:latest`), permitiendo la carga exitosa de la libreria C++ nativa de alta velocidad.

### 📝 Registro: [v0.5.8] - Optimizacion de rendimiento Docker con network_mode e ipc host
- **date-time**: 2026-10-12 01:05:00
- **Problema**:
- Overhead de ~7% en la velocidad de generacion dentro de Docker en la Raspberry Pi 5 (6.07 t/s vs 6.56 t/s nativo) debido al aislamiento del puente de red virtual y capa IPC de contenedor.
- **Causa**:
- La red virtual tipo bridge de Docker y el aislamiento de IPC introducen latencia de filtrado de paquetes y restricciones en memoria compartida.
- **Solución**:
- Se configuraron `network_mode: "host"` e `ipc: "host"` en `docker-compose.yml`, eliminando el puente virtual de red y permitiendo acceso de memoria compartida nativo en la Raspberry Pi 5.

### 📝 Registro: [v0.6.0] - Creación de subproyecto desacoplado interface (Frontend React + Backend FastAPI Voice/Chat)
- **date-time**: 2026-10-13 19:50:00
- **Problema**:
	- Se requiere crear un entorno completo desacoplado en `interface/` que disponga de una SPA en React con Vite, Tailwind y PNPM para chat y llamadas de voz en tiempo real, junto a un backend en Python (FastAPI) que gestione el WebSocket de audio bidireccional, VAD, síntesis TTS por fragmentos, transcripción STT y sirva los estáticos de `frontend/dist`. Además de `.env.example` y un `Dockerfile` autónomo.
- **Causa**:
	- Separar completamente la capa de interfaz de usuario y orquestación multimedia del proxy principal de Ollama, permitiendo que corra en su propio contenedor de forma independiente.
- **Solución**:
	- Se creó `interface/.env.example` con variables para `PORT`, `LLM_URL`, `TTS_URL`, `STT_URL` y timeouts.
	- Se implementó `interface/backend` con `SentenceChunker` (para streaming fluido a Piper TTS), clientes para LLM/TTS/STT, endpoints REST (`/api/chat`, `/api/stt`, `/api/tts`), endpoint WebSocket `/ws/call` con VAD de 700ms y cancelación de audio (barge-in), y montaje de archivos estáticos de SPA en `main.py`.
	- Se creó `interface/frontend` con React, TailwindCSS, Lucide, visualizador de audio, hook `useVoiceCall`, vista de llamada (`CallView`) y vista de chat (`ChatView`).
	- Se creó `interface/Dockerfile` multi-stage (Node/PNPM builder y Python runtime).

### 📝 Registro: [v0.6.1] - Integración de uv en Dockerfile y pyproject.toml de interface
- **date-time**: 2026-10-13 19:51:40
- **Problema**:
	- Se requiere utilizar el gestor de paquetes de alto rendimiento `uv` para la instalación de dependencias en Python dentro del contenedor de `interface`.
- **Causa**:
	- Acelerar significativamente los tiempos de build del contenedor y estandarizar la resolución rápida de paquetes de Python sin sobrecarga de pip.
- **Solución**:
	- Se importó el binario oficial de `uv` (`ghcr.io/astral-sh/uv:latest`) en el `Dockerfile` de `interface`.
	- Se configuró la instalación con `uv pip install --system --no-cache -r pyproject.toml`.
	- Se añadieron `pydantic-settings` y `uvicorn[standard]` a `dependencies` en `interface/backend/pyproject.toml`.

### 📝 Registro: [v0.6.2] - Adición de interface y caché compartida de uv en docker-compose.yml
- **date-time**: 2026-10-13 19:57:00
- **Problema**:
	- Se requiere incorporar el servicio `interface` a `docker-compose.yml` y unificar el almacenamiento de descarga de paquetes de `uv` entre el host (RPi5) y todos los contenedores para evitar duplicación y saturación de disco.
- **Causa**:
	- Cada contenedor descargaría y almacenaría sus propias copias de ruedas/paquetes pip a menos que se comparta el directorio de caché de `uv`.
- **Solución**:
	- Se añadió el servicio `interface` a `docker-compose.yml` con contexto `./interface`, modo `network_mode: "host"` y soporte para variables de entorno de LLM, TTS, STT.
	- Se mapeó el volumen del directorio de caché del host (`${UV_CACHE_DIR:-${HOME:-/root}/.cache/uv}:/root/.cache/uv`) tanto en `ollama-proxy` como en `interface`.
	- Se configuró `--mount=type=cache,target=/root/.cache/uv` en el `Dockerfile` de `interface` para compartir la caché durante el build con BuildKit.

### 📝 Registro: [v0.7.0] - Creación de microservicios de TTS (Piper) y STT (Vosk) en dockers/ e integración a docker-compose
- **date-time**: 2026-10-13 20:03:00
- **Problema**:
	- Se requiere incorporar contenedores dedicados e independientes para TTS (Piper) y STT (Vosk) en `docker-compose.yml`, clarificando la orquestación del WebSocket y asegurando persistencia de modelos y caché compartida de `uv`.
- **Causa**:
	- Los contenedores oficiales de Piper y Vosk suelen requerir configuraciones dispares (Wyoming en Piper, Kaldi en Vosk) o consumos excesivos de RAM si no se ajusta el modelo a la RPi5. Además, el backend es el encargado de gestionar el WebSocket de la llamada del cliente, pero STT necesita aceptar tanto audio por POST como por WebSocket.
- **Solución**:
	- Se creó la carpeta `dockers/piper/` con `pyproject.toml`, `Dockerfile` y `main.py` (FastAPI en puerto 5000, soporte para voz `es_ES-sharvard-medium` y persistencia en `/app/modelos`).
	- Se creó la carpeta `dockers/vosk/` con `pyproject.toml`, `Dockerfile` y `main.py` (FastAPI en puerto 2700, soporte HTTP `/asr` y WebSocket `/ws` para streaming continuo, modelo `vosk-model-small-es-0.42` optimizado para RPi5 y persistencia en `/app/modelos`).
	- Se actualizaron en `docker-compose.yml` los servicios `piper-tts` y `vosk-stt` con `network_mode: "host"`, volúmenes de modelos locales (`./modelos/piper` y `./modelos/vosk`) y volumen de caché unificado de `uv` (`${UV_CACHE_DIR:-${HOME:-/root}/.cache/uv}:/root/.cache/uv`).

### 📝 Registro: [v0.7.1] - Red Docker unificada y resolución DNS inter-contenedor
- **date-time**: 2026-10-13 20:11:40
- **Problema**:
	- En despliegues multi-contenedor dentro de Docker Compose, el uso de IPs estáticas o localhost no escala ni funciona de forma fiable entre contenedores aislados. Se requiere que los contenedores se comuniquen directamente usando el nombre del contenedor como dominio DNS.
- **Causa**:
	- Con `network_mode: "host"` no se aprovecha el DNS interno de Docker para resolución de nombres de servicio.
- **Solución**:
	- Se migró `docker-compose.yml` a una red bridge compartida (`ollama-net`).
	- Se configuraron los endpoints por defecto hacia los nombres de contenedor: `http://ollama-proxy:8000`, `http://piper-tts:5000` y `http://vosk-stt:2700`.
	- Se actualizaron [interface/backend/config.py](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/config.py) e [interface/.env.example](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/.env.example).
	- Se añadieron notas explicativas en la cabecera de `docker-compose.yml`.

### 📝 Registro: [v0.7.2] - Botón y modal de configuración para selección independiente de TTS y STT (Navegador vs RPi5)
- **date-time**: 2026-10-13 20:34:00
- **Problema**:
	- Se requiere disponer de un botón de configuración en la interfaz para poder alternar individualmente si el TTS y el STT se procesan en la Raspberry Pi 5 o en el navegador del usuario (para reducir consumo de CPU/RAM si fuera necesario).
- **Causa**:
	- Piper TTS y Vosk STT corriendo simultáneamente con el LLM en la RPi5 pueden saturar los núcleos de CPU en cargas concurrentes.
- **Solución**:
	- Se creó el componente `SettingsModal.jsx` con dos checkboxes independientes (uno para TTS y otro para STT), persistiendo la selección en `localStorage`.
	- En `ChatView.jsx`: se integró `window.speechSynthesis` para TTS del navegador y `SpeechRecognition` para STT del navegador cuando están activados, manteniendo el fallback a `/api/tts` y `/api/stt` de la RPi5.
	- En `useVoiceCall.js`: se añadió envío de modo de TTS (`tts_mode: "browser" | "rpi5"`) al WebSocket y reconocimiento directo en el navegador cuando se selecciona STT del navegador.
	- En `routes/call_ws.py`: el backend omite la síntesis con Piper en llamadas si el cliente solicita `tts_mode: "browser"`, enviando las oraciones para que el navegador las sintetice.

### 📝 Registro: [v0.7.3] - Etiquetas de imagen explícitas en docker-compose y script build-n-send.bat
- **date-time**: 2026-10-13 22:06:00
- **Problema**:
	- Se requiere que las imágenes Docker se compilen en el PC del usuario (para la arquitectura ARM64 de la RPi5) y se transfieran directamente por red/SSH a la Raspberry Pi 5 para evitar sobrecargar la RPi5 con compilaciones lentas.
- **Causa**:
	- Docker Compose en la RPi5 intentaba compilar en paralelo sin nombres de imagen explícitos vinculados a `docker load`.
- **Solución**:
	- Se asignaron nombres de imagen explícitos en `docker-compose.yml` (`image: ollama-proxy:latest`, `image: interface:latest`, `image: piper-tts:latest`, `image: vosk-stt:latest`).
	- Se creó `build-n-send.bat` que automatiza la compilación con `docker buildx build --platform linux/arm64` y el envío directo mediante `docker save | ssh user@ip "docker load"`, indicando al finalizar que solo resta ejecutar `docker compose up -d` en la RPi5.

### 📝 Registro: [v0.7.4] - Corrección de pnpm onlyBuiltDependencies en interface y control de flujo en build-n-send
- **date-time**: 2026-10-13 22:12:00
- **Problema**:
	- Durante la ejecución de `build-n-send.bat`, la compilación de `interface:latest` falló con `ERR_PNPM_IGNORED_BUILDS` al intentar ejecutar los scripts de compilación de `esbuild`.
- **Causa**:
	- Las versiones recientes de pnpm bloquean por defecto los scripts de postinstalación (`build scripts`) a menos que estén explícitamente autorizados en `package.json` bajo `pnpm.onlyBuiltDependencies`. Además, en `build-n-send.bat` no se comprobaba el errorlevel tras cada llamada en el bucle `:build_all`.
- **Solución**:
	- Se añadió `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` en [interface/frontend/package.json](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/package.json).
	- Se fijó la versión estable de pnpm en `pnpm@9.15.4` en [interface/Dockerfile](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/Dockerfile).
	- Se añadió verificación de `errorlevel` en [build-n-send.bat](file:///c:/work/person/hassan/Repos/ollama-proxy/build-n-send.bat) para abortar inmediatamente si alguna imagen falla.

### 📝 Registro: [v0.7.5] - Scripts de compilación individuales por servicio y corrección de workspace pnpm
- **date-time**: 2026-10-13 23:18:00
- **Problema**:
	- `pnpm run build` fallaba en `interface:latest` con `ERROR packages field missing or empty` debido a la presencia accidental de un archivo `pnpm-workspace.yaml`. Además, si un contenedor fallaba en `build-n-send.bat`, el usuario tenía que reiniciar todo el proceso.
- **Causa**:
	- `pnpm-workspace.yaml` hacía creer a pnpm que se trataba de un monorepo sin paquetes definidos. Falta de scripts independientes para compilar cada microservicio por separado.
- **Solución**:
	- Se eliminó `pnpm-workspace.yaml` y se creó `interface/.dockerignore` para omitir `node_modules` y `dist` locales.
	- Se crearon scripts independientes: `build-interface.bat`, `build-piper.bat`, `build-vosk.bat` y `build-proxy.bat`.
	- Se actualizó `build-n-send.bat` con menú interactivo para compilar todos o un servicio individual.

### 📝 Registro: [v0.7.6] - Migración a uv sync --no-build y uso de frontend/dist precompilado
- **date-time**: 2026-10-13 23:25:00
- **Problema**:
	- Se requiere que Docker no compile nada desde cero: ni el frontend con Node/pnpm (debe reutilizar el `dist/` precompilado) ni librerías Python desde código fuente (`--no-build`), y unificar el uso de `uv sync` en lugar de `uv pip`.
- **Causa**:
	- El Dockerfile de `interface` utilizaba una etapa previa con Node y pnpm que intentaba compilar el frontend. Además, `dockers/piper` y `dockers/vosk` usaban `uv pip` en vez del flujo estándar `uv sync`.
- **Solución**:
	- Se simplificó `interface/Dockerfile`: se eliminó Node/pnpm y ahora copia directamente la carpeta precompilada `frontend/dist/`.
	- Se configuraron `interface`, `piper` y `vosk` con `RUN uv sync --no-install-project --no-dev --no-build` para descargar exclusivamente ruedas (`wheels`) binarias precompiladas sin compilar código fuente.
	- Se actualizó el comando de inicio en todos los contenedores a `uv run --no-sync python main.py`.

### 📝 Registro: [v0.7.7] - Exclusión estricta de frontend/src, desactivación de bytecode y aislamiento de librerías
- **date-time**: 2026-10-13 23:32:00
- **Problema**:
	- Se requiere que las imágenes no compilen nada adentro, que no incluyan código fuente innecesario de frontend (`src/`), que utilicen solo `dist/` precompilado, que no generen bytecode `.pyc` superfluo en disco, y que cada contenedor mantenga sus librerías aisladas sin compartir entornos.
- **Causa**:
	- `interface/.dockerignore` requería ignorar explícitamente `frontend/src` y permitir `frontend/dist`. Además, los archivos `.pyc` entre Windows x64 y Linux ARM64 difieren en bytecode magic number, por lo que se debe usar `PYTHONDONTWRITEBYTECODE=1`.
- **Solución**:
	- Se actualizó `interface/.dockerignore` ignorando `frontend/src`, `node_modules` y `.vite`, permitiendo únicamente `frontend/dist`.
	- Se agregó `ENV PYTHONDONTWRITEBYTECODE=1` a los Dockerfiles de `interface`, `dockers/piper` y `dockers/vosk`.
	- Se mantienen entornos virtuales aislados por contenedor con instalación exclusiva de wheels precompiladas (`--no-build`).

### 📝 Registro: [v0.7.8] - Sincronización automática de docker-compose.yml y uso de flag --no-build en RPi5
- **date-time**: 2026-10-14 00:01:00
- **Problema**:
	- En la RPi5, tras cargar exitosamente la imagen `interface:latest`, la ejecución de `docker compose up -d interface` intentó compilar la imagen desde cero descargando Node.js.
- **Causa**:
	- La RPi5 aún tenía el archivo `docker-compose.yml` antiguo sin la etiqueta explícita `image: interface:latest`. Por defecto, Docker Compose buscaba `ollama-proxy-interface:latest`, y al no coincidir el nombre, intentó compilar.
- **Solución**:
	- Se actualizaron todos los scripts `.bat` (`build-interface`, `build-piper`, `build-vosk`, `build-proxy`, `build-n-send`) para sincronizar automáticamente `docker-compose.yml` con la RPi5 mediante `scp`.
	- Se documentó el comando de arranque con el flag `--no-build` (`docker compose up -d --no-build`) para impedir cualquier compilación accidental en la RPi5.

### 📝 Registro: [v0.7.9] - Corrección de 502 Bad Gateway: Integración con /v1/chat/completions y autenticación Bearer
- **date-time**: 2026-10-14 00:14:00
- **Problema**:
	- Al enviar un mensaje en el chat web (`POST /api/chat`), la interfaz devolvía un error `502 Bad Gateway: LLM proxy error` al usuario.
- **Causa**:
	- `llm_client.py` intentaba enviar peticiones a `/api/chat` en lugar del endpoint oficial expuesto por `ollama-proxy`, que es `/v1/chat/completions` (formato OpenAI estándar). Además, no propagaba la clave de autenticación requerida `PROXY_API_KEY` (`Bearer cambia_esta_clave`).
- **Solución**:
	- En `interface/backend/services/llm_client.py`: se implementó el protocolo estándar OpenAI `/v1/chat/completions` con soporte tanto para respuestas directas como para streaming SSE (`data: ...`), con fallback a `/api/chat`.
	- En `interface/backend/config.py`: se resolvió `API_KEY` utilizando por defecto `PROXY_API_KEY` y `LLM_API_KEY`.
	- En `docker-compose.yml`: se inyectaron `API_KEY` y `PROXY_API_KEY` a las variables de entorno del contenedor `interface`.

### 📝 Registro: [v0.7.10] - Correccion de uv sync en Dockerfiles de Vosk y Piper
- **date-time**: 2026-10-14 00:21:00
- **Problema**:
	- El build de Docker para `vosk-stt` fallaba con error de resolucion de dependencias: `Because all versions of srt have no usable wheels and vosk>=0.3.45 depends on srt... hint: Wheels are required for srt because building from source is forbidden for all packages (i.e., with --no-build)`.
- **Causa**:
	- El flag `--no-build` en `uv sync` prohibia a `uv` desempaquetar y construir distribuciones de codigo fuente puro (sdist `.tar.gz`) como el paquete `srt` requerido por `vosk`.
- **Solución**:
	- Se elimino el flag `--no-build` de `dockers/vosk/Dockerfile`, `dockers/piper/Dockerfile` e `interface/Dockerfile`, permitiendo que `uv sync --no-install-project --no-dev` instale dependencias sdist de forma instantanea sin requerir herramientas de compilacion C/C++.

### 📝 Registro: [v0.7.11] - Separacion de scripts en build.bat y send.bat sin compresion ni temporales
- **date-time**: 2026-10-14 00:42:00
- **Problema**:
	- Se requeria separar el ciclo de creacion de contenedores del de transferencia a la RPi5, eliminando cualquier guardado en archivos temporales o pasos de compresion/descompresion para evitar saturar la velocidad de escritura en disco del RPi5.
- **Causa**:
	- Los scripts previos compilaban y transferian en un solo bloque. Si la conexion o el destino fallaban, habia que recomenzar, y los metodos basados en empaquetado a disco intermedio generan doble escritura innecesaria en la tarjeta del RPi5.
- **Solución**:
	- Se creo `build.bat` para compilar localmente en Windows (`linux/arm64`) sin conexion SSH.
	- Se creo `send.bat` para transmitir por canal SSH directo (`docker save | ssh docker load`), transmitiendo en stream puro sin compresión gzip y sin crear archivos temporales en el sistema de archivos del RPi5.

### 📝 Registro: [v0.7.12] - Bloqueo definitivo de build y pull en docker-compose.yml
- **date-time**: 2026-10-14 01:49:00
- **Problema**:
	- Al ejecutar `docker compose up -d interface` en la Raspberry Pi, Docker Compose intentaba hacer pull de `interface:latest` y, al no encontrarla en Docker Hub, procedia a compilar (`build`) el contenedor desde cero en la RPi5.
- **Causa**:
	- `docker-compose.yml` contenia directivas `build:` para cada servicio y no tenia definida una politica estricta de pull, haciendo que Compose intente descargar o compilar siempre.
- **Solución**:
	- Se eliminaron completamente todas las secciones `build:` de [docker-compose.yml](file:///c:/work/person/hassan/Repos/ollama-proxy/docker-compose.yml).
	- Se configuro `pull_policy: never` en todos los servicios (`ollama-proxy`, `interface`, `piper-tts`, `vosk-stt`), imposibilitando que Docker intente descargar de internet o compilar localmente en la RPi5.

### 📝 Registro: [v0.7.13] - Actualizacion de seleccion nemotecnica en build.bat y send.bat
- **date-time**: 2026-10-14 01:54:00
- **Problema**:
	- La seleccion numerica del 1 al 5 en los scripts de construccion y envio resultaba confusa para identificar los servicios.
- **Causa**:
	- Se utilizaban indices numericos sin asociacion directa a las iniciales de los contenedores.
- **Solución**:
	- Se modificaron [build.bat](file:///c:/work/person/hassan/Repos/ollama-proxy/build.bat) y [send.bat](file:///c:/work/person/hassan/Repos/ollama-proxy/send.bat) para utilizar `*` para todos los servicios e iniciales claras: `i` (interface), `p` (piper-tts), `v` (vosk-stt) y `o` (ollama-proxy), manteniendo compatibilidad retroactiva.

### 📝 Registro: [v0.7.14] - Montaje en caliente (bind mounts) de codigo fuente en docker-compose.yml
- **date-time**: 2026-10-14 02:26:00
- **Problema**:
	- Cualquier cambio en el codigo fuente requeria reconstruir la imagen Docker completa y retransferirla por la red a la RPi5.
- **Causa**:
	- El codigo residia unicamente dentro de las capas compiladas del contenedor, sin enlaces directos al repositorio local del host.
- **Solución**:
	- Se mapearon volumenes de codigo fuente en [docker-compose.yml](file:///c:/work/person/hassan/Repos/ollama-proxy/docker-compose.yml) para `ollama-proxy` (`./backend`, `./main.py`), `interface` (`routes`, `services`, `main.py`, `config.py`, `frontend/dist`), `piper-tts` y `vosk-stt` (`main.py`).
	- Ahora cualquier modificacion se aplica en la RPi5 con un simple `git pull` y `docker compose restart <servicio>` en 1 segundo.

### 📝 Registro: [v0.7.15] - Conversion de interfaz a PWA instalable en Android
- **date-time**: 2026-10-14 02:32:00
- **Problema**:
	- Se requeria poder instalar la aplicacion web de interfaz directamente en Android como aplicacion independiente (PWA) desde el navegador.
- **Causa**:
	- La aplicacion carecia de Web App Manifest, Service Worker y metadatos moviles necesarios para que Chrome/Android ofrezca la instalacion.
- **Solución**:
	- Se creo [manifest.webmanifest](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/public/manifest.webmanifest) con soporte `standalone`, orientacion `portrait` e iconos dedicados (192x192, 512x512 y maskable).
	- Se implemento [sw.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/public/sw.js) para gestion de cache offline y soporte completo de PWA.
	- Se actualizaron los metadatos de [index.html](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/index.html) y el registro en [main.jsx](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/main.jsx).
	- Se anadio detector de `beforeinstallprompt` y boton interactivo "Instalar" en la cabecera de [App.jsx](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/App.jsx).
	- Se reconstruyo el bundle de produccion en `interface/frontend/dist`.

### 📝 Registro: [v0.7.16] - Inclusion de libatomic1 en Dockerfile de Vosk y Piper
- **date-time**: 2026-10-14 02:50:00
- **Problema**:
	- El contenedor `vosk-stt` fallaba en Raspberry Pi al arrancar: `OSError: cannot load library '/app/.venv/lib/python3.11/site-packages/vosk/libvosk.so': libatomic.so.1: cannot open shared object file: No such file or directory`.
- **Causa**:
	- El binario compartido `libvosk.so` en arquitectura ARM64 requiere la biblioteca atomica del sistema GNU (`libatomic.so.1`), que no viene por defecto en la imagen base `python:3.11-slim`.
- **Solución**:
	- Se anadio el paquete `libatomic1` a los Dockerfiles de [dockers/vosk/Dockerfile](file:///c:/work/person/hassan/Repos/ollama-proxy/dockers/vosk/Dockerfile) y [dockers/piper/Dockerfile](file:///c:/work/person/hassan/Repos/ollama-proxy/dockers/piper/Dockerfile).

### 📝 Registro: [v0.7.17] - Soporte multi-contenedor por comas y eliminacion de scp docker-compose en send.bat
- **date-time**: 2026-10-14 02:59:00
- **Problema**:
	- Se necesitaba poder compilar y enviar múltiples contenedores a la vez indicándolos separados por comas (ej. `v,p`), y eliminar la copia automática de `docker-compose.yml` que ya gestiona manualmente el usuario.
- **Causa**:
	- Los scripts solo aceptaban una única opción atómica y siempre ejecutaban `scp docker-compose.yml` al finalizar.
- **Solución**:
	- Se actualizaron [send.bat](file:///c:/work/person/hassan/Repos/ollama-proxy/send.bat) y [build.bat](file:///c:/work/person/hassan/Repos/ollama-proxy/build.bat) con un bucle de despacho que procesa listas separadas por comas o espacios (ej. `v,p` o `i,v,p`).
	- Se removió por completo la sincronización forzada de `docker-compose.yml` de `send.bat`.

### 📝 Registro: [v0.7.18] - Correccion de cierre inmediato de WebSocket en modo llamada
- **date-time**: 2026-10-14 03:11:00
- **Problema**:
	- Al presionar el boton para iniciar la llamada de voz, el WebSocket se cerraba al instante.
- **Causa**:
	- En `useVoiceCall.js`, el `useEffect` de limpieza tenia `[endCall]` en sus dependencias, provocando que cualquier actualizacion de estado disparara el desmontaje y cierre del socket por re-render.
	- La adquisicion de microfono `getUserMedia` se ejecutaba dentro de `ws.onopen` sin captura de excepciones, fallando silenciosamente si el contexto no era seguro (HTTP) o no habia permisos concedidos.
	- En el backend `call_ws.py`, no se comprobaba el mensaje `websocket.disconnect` antes de llamar recursivamente a `receive()`, arrojando errores ASGI en Starlette.
- **Solución**:
	- Se desacoplo la limpieza del hook para que solo se ejecute al desmontar el componente (`[]`).
	- Se traslado la peticion de microfono antes de la conexion WebSocket para validar permisos y contextos HTTP/HTTPS de forma interactiva.
	- Se anadio soporte explicito de desconexion y trazabilidad detallada de logs tanto en el backend (`call_ws.py`) como en el hook (`useVoiceCall.js`).
	- Se compilo el nuevo bundle frontend en `interface/frontend/dist`.

### 📝 Registro: [v0.7.19] - Resolucion de ReferenceError TDZ en useVoiceCall.js
- **date-time**: 2026-10-14 13:19:00
- **Problema**:
	- La aplicacion web arrojaba un error en la consola del navegador al intentar montar el componente de llamada: `ReferenceError: Cannot access 'A' before initialization`.
- **Causa**:
	- `startCall` incluia a `endCall` en su array de dependencias (`useCallback`), pero `endCall` estaba declarado debajo de `startCall` en el codigo fuente. En JavaScript (`const`), esto provoca un error de Temporal Dead Zone (TDZ).
- **Solución**:
	- Se reordeno la declaracion en [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js), definiendo `endCall` antes de `startCall`.
	- Se reconstruyo el bundle de produccion en `interface/frontend/dist`.

### 📝 Registro: [v0.7.20] - Preconfiguracion de cabeceras WAV en Piper TTS para evitar crash por fonemas vacios
- **date-time**: 2026-10-14 13:32:00
- **Problema**:
	- Al sintetizar audio en `piper-tts`, FastAPI arrojaba un error 500: `wave.Error: # channels not specified` al salir del contexto `with wave.open(...)`.
- **Causa**:
	- Piper TTS inicializa las cabeceras del objeto `wave.Wave_write` de forma perezosa al recibir el primer bloque de audio sintetizado. Si el texto enviado solo contiene signos de puntuacion (ej. `. . .` o silencios) o produce 0 chunks de audio, Piper no escribe datos y el modulo `wave` de Python falla al cerrar el archivo si no se han especificado los canales ni el sample rate.
- **Solución**:
	- En [dockers/piper/main.py](file:///c:/work/person/hassan/Repos/ollama-proxy/dockers/piper/main.py), se preconfiguraron explicitamente los parametros `setnchannels(1)`, `setsampwidth(2)` y `setframerate(sample_rate)` antes de invocar `voice.synthesize`.
	- Se anadio la funcion `create_empty_wav` para retornar cabeceras WAV validas de forma inmediata si el texto no contiene caracteres alfanumericos.

### 📝 Registro: [v0.7.21] - Consumo de chunks en generador de sintesis de Piper TTS para emision de audio PCM
- **date-time**: 2026-10-14 14:05:00
- **Problema**:
	- Piper TTS retornaba una respuesta HTTP 200 con binario WAV sin arrojar excepciones, pero no se escuchaba voz ni audio en el cliente (silencio absoluto).
- **Causa**:
	- En la API de Piper TTS (`piper-tts` / `piper1-gpl`), el método `voice.synthesize(text)` es una función generadora que retorna un iterable de objetos `AudioChunk` conteniendo `audio_int16_bytes`.
	- Al invocar `voice.synthesize(text, wav_file)` como llamada ordinaria sin iterar sobre el generador retornado, la función nunca ejecutaba el ciclo de inferencia y no escribía ningún bloque PCM en el archivo WAV. En consecuencia, el archivo generado solo contenía la cabecera RIFF de 44 bytes con 0 frames de datos de audio (duración 0.0 segundos).
- **Solución**:
	- En [dockers/piper/main.py](file:///c:/work/person/hassan/Repos/ollama-proxy/dockers/piper/main.py), se reestructuró `synthesize_text_to_wav` implementando un esquema multi-estrategia resiliente:
		1. Itera activamente sobre el generador `voice.synthesize(text)`, extrayendo `chunk.audio_int16_bytes` y escribiéndolos en `wav_file.writeframes()`.
		2. Soporte fallback a `voice.synthesize_stream_raw(text)` para variantes que devuelven directamente bloques de bytes PCM crudos.
		3. Soporte fallback para variantes legacy con `voice.synthesize_wav(text, wav_file)`.
	- Con esto, el WAV devuelto contiene la totalidad de los datos PCM sintetizados, permitiendo una reproducción nítida e instantánea en el navegador o dispositivo móvil.

### 📝 Registro: [v0.7.22] - Supresión de eco acústico y corrección de captura continua de micrófono en móviles
- **date-time**: 2026-10-15 02:40:00
- **Problema**:
	- En ordenador portátil: el micrófono grababa la voz del asistente emitida por los altavoces, provocando un bucle de retroalimentación (eco) en el que el asistente se respondía a sí mismo.
	- En teléfono móvil: el asistente solo escuchaba el primer mensaje del usuario; tras responder el asistente, dejaba de escuchar cualquier mensaje posterior.
- **Causa**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js), el procesador de audio `ScriptProcessorNode` estaba conectado directamente al destino de audio (`audioCtx.destination`), alimentando el micrófono directo a los altavoces. En dispositivos móviles con cancelación de eco de hardware (AEC), esto causaba que el sistema operativo silenciara por completo el stream del micrófono tras la primera reproducción.
	- El bucle `onaudioprocess` no verificaba si el asistente estaba hablando (`isAssistantSpeakingRef.current`), continuando el envío de frames PCM de los altavoces hacia el servidor durante toda la respuesta.
	- En [call_ws.py](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/routes/call_ws.py), los frames de audio entrantes se seguían acumulando en `audio_buffer` mientras `current_task` estaba activo, y el buffer no se limpiaba al emitir `assistant_done`, enviando el residuo de audio a Vosk 700ms después de que el asistente callara.
	- En reconocimiento de navegador (`useBrowserSTT`), `webkitSpeechRecognition` en Android Chrome se detiene de forma nativa tras una pausa; la falta de reinicio en el callback `onend` dejaba el reconocimiento inerte para los siguientes turnos.
- **Solución**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js):
		1. Se separaron los contextos de audio: `micContextRef` exclusivo para la captura a 16 kHz y `playbackContextRef` para la reproducción a frecuencia nativa.
		2. Se enrutó el `ScriptProcessorNode` a través de un `GainNode` con ganancia cero (`silentGain.gain.value = 0`) hacia `destination`, permitiendo el disparo continuo de `onaudioprocess` sin alimentar el micrófono a los altavoces.
		3. Se agregaron referencias reactivas (`isAssistantSpeakingRef`, `isMutedRef`) que silencian la transmisión de audio por WebSocket mientras el asistente habla, con un periodo de gracia acústica de 300ms tras concluir la reproducción.
		4. Se implementó el manejador `rec.onend` para reiniciar automáticamente el reconocimiento nativo en Android cuando la llamada sigue activa.
	- En [call_ws.py](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/routes/call_ws.py):
		1. Se descartan paquetes PCM de micrófono entrantes si `current_task and not current_task.done()`.
		2. Se limpian `audio_buffer` y el temporizador de silencio al finalizar `run_assistant_pipeline` (`assistant_done`) y al cancelar la tarea.
	- Se reconstruyó el bundle estático de producción de la interfaz (`pnpm build`) en `interface/frontend/dist`.

### 📝 Registro: [v0.7.23] - Sincronizacion de turnos cliente-servidor y eliminacion de bucle de auto-escucha
- **date-time**: 2026-10-15 02:49:00
- **Problema**:
	- Tanto en el teléfono como en el portátil, el asistente escuchaba su propia voz emitida por los altavoces mientras respondía y entraba en un bucle infinito de responderse a sí mismo.
- **Causa**:
	- El pipeline del backend (`run_assistant_pipeline` en `call_ws.py`) genera los tokens y sintetiza los chunks de audio en ~1 segundo, marcando `current_task` como finalizado de inmediato en el servidor.
	- Sin embargo, el navegador en el cliente requiere de 5 a 10 segundos para reproducir físicamente esos bloques de audio por los altavoces.
	- Durante ese lapso en que el asistente seguía hablando físicamente, el servidor consideraba que el turno del asistente ya había concluido y procesaba el audio captado por el micrófono (la propia voz del asistente saliendo de los altavoces). Además, en el cliente, la cola de audio se vaciaba (`audioQueue.length === 0`) mientras el último bloque aún se reproducía, desbloqueando el micrófono prematuramente.
- **Solución**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js):
		1. Bloqueo inmediato del micrófono desde el evento `assistant_thinking`, impidiendo cualquier envío durante la generación del LLM.
		2. Control estricto con `isServerDoneRef` y seguimiento de reproducción en curso: el micrófono permanece completamente mudo hasta que todos los chunks se hayan reproducido físicamente en los altavoces más 400ms de disipación acústica.
		3. Notificación explícita `playback_done` por WebSocket al servidor en el instante exacto en que cesa el sonido del altavoz.
	- En [call_ws.py](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/routes/call_ws.py):
		1. Implementado flag `is_assistant_turn = True` que descarta incondicionalmente cualquier frame de micrófono hasta recibir la confirmación `playback_done` del cliente.
		2. Limpieza exhaustiva de `audio_buffer` al recibir `playback_done`, garantizando que únicamente la voz fresca del usuario sea enviada a Vosk STT.
	- Se reconstruyó el bundle estático de producción (`pnpm build`) en `interface/frontend/dist`.

### 📝 Registro: [v0.7.24] - Activacion de cancelacion de eco acustico (AEC) nativa y reproduccion desacoplada por HTMLAudioElement
- **date-time**: 2026-10-15 03:12:00
- **Problema**:
	- La cancelación de eco de hardware/navegador (AEC), la supresión de ruido (NS) y el control automático de ganancia (AGC) no estaban suprimiendo el audio emitido por el altavoz, provocando que el micrófono capturara la voz del asistente y generara ecos o cortes artificiales.
- **Causa**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js), las restricciones pasadas a `getUserMedia` incluían `sampleRate: 16000`. En navegadores basados en Chromium (desktop y Android), forzar una frecuencia distinta a la nativa del hardware (44.1/48 kHz) en la captura deshabilita o degrada críticamente el pipeline de correlación de eco acústico por hardware (AEC).
	- Además, la reproducción se realizaba mediante nodos Web Audio (`decodeAudioData` hacia `AudioContext.destination`), los cuales no se enrutan automáticamente al bus de referencia de AEC del navegador. Solo los elementos HTML5 `<audio>` son reconocidos por el gestor de audio del sistema operativo como fuentes remotas para sustracción de eco.
	- Por último, se habían añadido bloqueos y pausas artificiales en el WebSocket que impedían la conversación fluida dúplex real (barge-in).
- **Solución**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js):
		1. Se removió `sampleRate: 16000` de las restricciones de `getUserMedia`, habilitando la captura a la frecuencia nativa del hardware con soporte completo para `echoCancellation`, `noiseSuppression`, `autoGainControl`, `googEchoCancellation`, `googAutoGainControl`, `googNoiseSuppression` y `googHighpassFilter`.
		2. La conversión a 16 kHz mono para Vosk se realiza ahora limpiamente en el `AudioContext` desacoplado mediante `createMediaStreamSource`.
		3. Se reemplazó la reproducción por un elemento nativo `HTMLAudioElement` (`audioElementRef.current = new Audio()`), conectándolo directamente al pipeline de referencia de AEC del navegador para que el sonido de los altavoces sea cancelado en tiempo real de la entrada del micrófono.
		4. Se eliminaron los silenciadores artificiales para permitir conversación full-dúplex con interrupción natural por voz.
	- En [call_ws.py](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/routes/call_ws.py):
		1. Se removió el estado bloqueante `is_assistant_turn`, permitiendo la recepción continua y sin latencia de audio filtrado por AEC.
	- Se reconstruyó el bundle estático de producción (`pnpm build`) en `interface/frontend/dist`.

### 📝 Registro: [v0.7.25] - Configuración de interrupción por voz del asistente (Barge-in / Full-Duplex vs Half-Duplex)
- **date-time**: 2026-10-15 03:18:00
- **Problema**:
	- El usuario requería poder configurar en las opciones si desea que al hablar mientras el asistente está respondiendo, el asistente se interrumpa de inmediato y escuche la nueva pregunta para responderla, o que espere a terminar su locución completa sin interrupciones.
- **Causa**:
	- Hasta ahora el sistema funcionaba con cancelación de eco pero no exponía un toggle explícito de barge-in ("Interrumpir al hablar"). En entornos con mucho ruido ambiental o altavoz elevado, el usuario puede preferir Half-Duplex (no interrumpir al asistente hasta que termine de hablar) o Full-Duplex (barge-in instantáneo con cancelación y descarte de cola de audio).
- **Solución**:
	- Añadido toggle en `SettingsModal.jsx` para "Interrumpir al hablar (Barge-in)" con persistencia en `localStorage` (`voice_llm_settings.allowBargeIn`).
	- En `useVoiceCall.js`:
		- Si `allowBargeIn` está desactivado y el asistente está reproduciendo (`isPlayingRef.current`), se omite el envío de tramas de micrófono y eventos STT.
		- Si `allowBargeIn` está activado (por defecto) y el usuario habla o se detecta `user_transcript`, se invoca de inmediato `stopCurrentAudioPlayback()` deteniendo el elemento HTMLAudio y vaciando la cola.
		- Sincronización dinámica de `allow_barge_in` por WebSocket al cambiar las opciones.
	- En `call_ws.py`:
		- Se recibe `allow_barge_in` en el mensaje `config`.
		- Si `allow_barge_in` es falso y existe un `current_task` en curso del asistente, se descartan las tramas binarias de audio y `user_text` entrantes.
	- Actualizada la versión a `v0.7.25` en `project_status.md`.

### 📝 Registro: [v0.7.27] - Cancelacion de eco acustico (AEC) nativa en navegador mediante loopback WebRTC in-memory
- **date-time**: 2026-10-15 03:52:00
- **Problema**:
	- El micrófono del portátil o del teléfono móvil seguía captando el audio emitido por los altavoces durante la respuesta del asistente, sin que el motor de Acoustic Echo Cancellation (AEC) del navegador lo suprimiese.
- **Causa**:
	- En Chromium / WebRTC, el motor de cancelación de eco acústico (`webrtc::AudioProcessing` / AEC3) requiere una **señal de referencia de renderizado** (`ProcessReverseStream()`) para saber qué audio exacto debe restar de la captura del micrófono (`getUserMedia`).
	- En la arquitectura interna del navegador, la reproducción a través de un elemento `new Audio(blobUrl)` desacoplado no está asociada a ningún contexto WebRTC, por lo que el subsistema de audio del navegador lo reproduce como un archivo multimedia independiente y **nunca entrega sus muestras al buffer de referencia de AEC**. Al carecer de señal de referencia, el AEC no tiene forma de cancelar el sonido del altavoz.
	- El motor de AEC de Chromium únicamente engancha la señal de referencia de altavoz cuando la reproducción proviene de un track de `RTCPeerConnection` asociado a un elemento `<audio srcObject=stream>`.
- **Solución**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js):
		- Se implementó un loopback local in-memory de WebRTC entre dos pares locales (`pc1` y `pc2`) con latencia cero:
			1. Se genera un `MediaStreamDestinationNode` en el `AudioContext` de reproducción y se conecta a `pc1`.
			2. `pc2` recibe el track en `ontrack` y lo asigna a un elemento `<audio id="webrtc-aec-speaker" autoplay playsinline>` insertado en el DOM.
			3. Al reproducirse mediante WebRTC, `WebRtcAudioRenderer` entrega simultáneamente el audio a los altavoces físicos y alimenta el buffer de referencia inverso de AEC de Chromium.
			4. Cuando `getUserMedia({ audio: { echoCancellation: true } })` captura el micrófono, el motor AEC de WebRTC sustrae matemáticamente el audio emitido por el altavoz, cancelando el eco en tiempo real directamente en el dispositivo cliente.
	- Recompilado el bundle estático de producción (`pnpm build`) en `interface/frontend/dist`.

### 📝 Registro: [v0.7.28] - Restricciones nativas estandar en getUserMedia, logging de settings y normalizacion por DynamicsCompressorNode
- **date-time**: 2026-10-15 19:35:00
- **Problema**:
	- Se requerían las restricciones estándar nativas exactas en `getUserMedia` (`echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`) sin flags propietarios, verificación por consola de los settings aplicados al track de audio y normalización de volumen.
- **Causa**:
	- `getUserMedia` contenía flags propietarios heredados (`googEchoCancellation`, etc.) y no realizaba log de verificación de `track.getSettings()`. Además, se requería compresión dinámica para nivelar el volumen de voz.
- **Solución**:
	- En [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js):
		- Simplificadas las restricciones de `getUserMedia` a las nativas estándar: `{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }`.
		- Añadida verificación en consola: `console.log("[VoiceCall] Microphone track settings:", track?.getSettings())`.
		- Añadido un `DynamicsCompressorNode` en la cadena de Web Audio antes de `ScriptProcessorNode` para normalizar la amplitud de voz, amplificar susurros y prevenir distorsión por picos.
	- Recompilado el bundle estático de producción (`pnpm build`) en `interface/frontend/dist`.

### 📝 Registro: [v0.7.29] - Incorporacion de voiceIsolation: true en constraints de getUserMedia
- **date-time**: 2026-10-15 19:53:00
- **Problema**:
	- Se consultó sobre el parámetro `"voiceIsolation: false"` reportado por `track.getSettings()` y si requería habilitarse en las restricciones del micrófono.
- **Causa**:
	- `voiceIsolation` es una restricción W3C que delega en el sistema operativo (Apple Voice Isolation en macOS/iOS, Windows Studio Effects Voice Focus con NPU) la separación neuronal de la voz humana frente al ruido acústico de la habitación y fugas del altavoz. Estaba inactivo (`false`) por omisión.
- **Solución**:
	- Añadido `voiceIsolation: true` en las restricciones de `getUserMedia` en [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js). En sistemas compatibles se activa el aislamiento neuronal de voz a nivel de SO; en sistemas que no lo soportan, la especificación W3C lo ignora con seguridad sin producir error.
	- Recompilado el bundle estático de producción (`pnpm build`) en `interface/frontend/dist`.

### 📝 Registro: [v0.7.30] - Cancelación de eco acústico nativa por hardware continua en llamada
- **date-time**: 2026-10-15 20:58:00
- **Problema**:
	- Al utilizar el STT del navegador, el audio del altavoz se filtraba al micrófono debido a que `getUserMedia` con restricciones AEC (`echoCancellation: true`) solo se inicializaba si se usaba Vosk, dejando el micrófono sin filtro nativo de hardware durante el reconocimiento del navegador.
- **Causa**:
	- `getUserMedia` estaba condicionado dentro del bloque `else` de `settings?.useBrowserSTT`.
- **Solución**:
	- Reubicada la llamada de `navigator.mediaDevices.getUserMedia` para ejecutarse siempre al iniciar la llamada en [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js), manteniendo el stream de audio con AEC, supresión de ruido y control de ganancia activo durante toda la sesión.
	- Recompilado el frontend con `pnpm build`.

### 📝 Registro: [v0.7.31] - Eliminación de WebRTC loopback y salida de audio directa
- **date-time**: 2026-10-15 21:10:00
- **Problema**:
	- Existía código legacy de un WebRTC loopback (`RTCPeerConnection`, `playStreamDest` y etiqueta `<audio id="webrtc-aec-speaker">`) creado anteriormente para forzar el enrutamiento de audio al AEC, complejizando innecesariamente la reproducción de voz.
- **Causa**:
	- Solución workaround anterior que ya no es necesaria con la captura nativa continua de `getUserMedia`.
- **Solución**:
	- Eliminadas las referencias y creación de `pc1`, `pc2`, `playStreamDest` y el elemento del DOM `webrtc-aec-speaker` en [useVoiceCall.js](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/frontend/src/hooks/useVoiceCall.js).
	- Enrutado el audio del asistente directamente a `playCtx.destination` en `playNextAudioChunk`.
	- Recompilado el bundle con `pnpm build`.

### 📝 Registro: [v0.7.32] - Conexión directa streaming a Vosk WebSocket con subtítulos parciales en vivo
- **date-time**: 2026-10-15 22:27:00
- **Problema**:
	- Al activar Vosk en la llamada, el cliente enviaba paquetes de audio PCM16 por WebSocket pero el servidor nunca respondía ni transcribía.
- **Causa**:
	- En `call_ws.py`, un temporizador de silencio (`silence_timer_task`) se cancelaba y reiniciaba 4 veces por segundo con cada paquete entrante, impidiendo que el audio llegara a transcribirse. Además, no se aprovechaba el endpoint WebSocket nativo de Vosk ni se mostraba la transcripción parcial mientras el usuario hablaba.
- **Solución**:
	- Enlazado `call_ws.py` directamente con el endpoint WebSocket de Vosk (`ws://vosk-stt:2700/ws`).
	- Implementado reenvío directo de PCM16 y escucha asíncrona de resultados de Vosk:
	  - Emisión de `is_final: false` con texto parcial (`partial`) en tiempo real hacia el frontend para visualización inmediata en pantalla.
	  - Emisión de `is_final: true` con texto finalizado para disparar la generación y respuesta del LLM.
	- En `useVoiceCall.js`, actualizado el handler de `user_transcript` para refrescar `userTranscript` con parciales y agregar a `callHistory` únicamente al finalizar la frase.
	- Recompilado el bundle de frontend con `pnpm build`.

### 📝 Registro: [v0.7.33] - Corrección de AttributeError en cliente WebSocket de Vosk
- **date-time**: 2026-10-15 22:42:00
- **Problema**:
	- En dispositivos móviles la llamada WebSocket se cerraba abruptamente tras enviar los dos primeros mensajes (configuración y primer bloque de audio PCM16).
- **Causa**:
	- En la biblioteca `websockets` (versiones >= 12), las instancias de conexión (`ClientConnection`) no poseen el atributo `.closed`. La comprobación `vosk_ws.closed` provocaba un `AttributeError` no capturado al recibir el primer chunk binario, provocando el cierre inmediato del WebSocket.
- **Solución**:
	- Sustituida la comprobación por un método seguro `ensure_vosk()` con reconexión perezosa y captura explícita de excepciones en el envío `conn.send(pcm_data)`.
	- En el bloque `finally:`, asegurado el cierre de `vosk_ws` mediante comprobación de existencia y bloque `try/except`.

### 📝 Registro: [v0.7.34] - Dictado por voz WebSocket en tiempo real en la vista de Chat
- **date-time**: 2026-10-15 22:58:00
- **Problema**:
	- Al pulsar el micrófono en la vista de chat con Vosk, siempre devolvía `{"text":""}` y auto-enviaba sin permitir al usuario revisar ni corregir lo hablado.
- **Causa**:
	- `ChatView.jsx` utilizaba `MediaRecorder` empaquetando audio WebM/Opus en un Blob etiquetado erróneamente como WAV hacia `/api/stt`, lo que provocaba fallo de decodificación en Kaldi de Vosk. Además, auto-enviaba el mensaje inmediatamente en vez de volcarlo al input de texto.
- **Solución**:
	- Implementado endpoint WebSocket `/ws/stt` en `call_ws.py` que reenvía PCM16 continuo a Vosk y emite transcripciones parciales y finales.
	- Refactorizado `ChatView.jsx` para transmitir PCM16 vía WebSocket a `/ws/stt` (o usar `SpeechRecognition` con `interimResults = true`) y volcar el texto transcrito directamente en el campo `input` en tiempo real.
	- Eliminado el auto-envío forzado: el usuario puede revisar, editar y enviar manualmente el texto dictado.
	- Recompilado el frontend con `pnpm build`.

### 📝 Registro: [v0.7.35] - Corrección de parseo JSON y escritura en tiempo real en el input de chat
- **date-time**: 2026-10-15 23:14:40
- **Problema**:
	- Al dictar por voz en la vista de chat, el texto transcrito por Vosk/STT no aparecía en el input de texto y la transcripción no se mostraba.
- **Causa**:
	- En `ChatView.jsx`, la función `ws.onmessage` contenía una referencia errónea a `json.loads` en código JavaScript (`json.loads ? JSON.parse(...)`), provocando un `ReferenceError: json is not defined` capturado silenciosamente en el bloque `catch`.
- **Solución**:
	- `interface/frontend/src/components/ChatView.jsx`: sustituido por `JSON.parse(event.data)`, añadido `committedTextRef` para acumular frases continuas y parciales sin sobrescribir texto previo en el input, y reconstruido el frontend con `pnpm build`.

### 📝 Registro: [v0.7.36] - Detener grabación de voz al enviar mensaje en ChatView
- **date-time**: 2026-10-15 23:27:50
- **Problema**:
	- Al pulsar el botón de enviar o pulsar Enter mientras se está grabando audio para transcripción, la grabación continuaba activa en lugar de finalizarse automáticamente.
- **Causa**:
	- `handleSend` y el evento `onSubmit` del formulario no invocaban `stopVoiceRecording()` al despachar el mensaje.
- **Solución**:
	- En `interface/frontend/src/components/ChatView.jsx`, se agregó la llamada a `stopVoiceRecording()` en `handleSend` y en `onSubmit` si `isRecording` está activo, deteniendo inmediatamente el micrófono y cerrando el WebSocket de transcripción al enviar.
	- Recompilado el frontend con `pnpm build`.

### 📝 Registro: [v0.7.37] - Streaming WebSocket token a token en la vista de Chat
- **date-time**: 2026-10-15 23:31:45
- **Problema**:
	- En la vista de chat, las respuestas del modelo LLM se solicitaban mediante HTTP POST síncrono (`/api/chat`), obligando al usuario a esperar que la respuesta completa terminara de generarse antes de mostrar todo de golpe.
- **Causa**:
	- `handleSend` esperaba la resolución de `await res.json()` en vez de consumir un flujo por WebSocket o Server-Sent Events.
- **Solución**:
	- En `interface/backend/routes/call_ws.py`, se implementó el endpoint WebSocket `@router.websocket("/ws/chat")` que envía eventos `{ "type": "token", "token": str }` en streaming a medida que el LLM genera cada token, culminando con `{ "type": "done", "full_text": str }`.
	- En `interface/frontend/src/components/ChatView.jsx`, se refactorizó `handleSend` para conectarse a `/ws/chat`, mostrando el bocadillo de respuesta con actualización progresiva en tiempo real y cursor pulsante, con fallback transparente a HTTP ante caídas de red.
	- Documentado el endpoint en `project_status.md` y recompilado el frontend con `pnpm build`.

### 📝 Registro: [v0.7.38] - Síntesis TTS por fragmentos y frases progresivas en tiempo real en el Chat
- **date-time**: 2026-10-15 23:41:00
- **Problema**:
	- En la vista de chat, el TTS requería que terminara toda la generación de texto del modelo antes de poder reproducirse, impidiendo escuchar la respuesta mientras se está generando.
- **Causa**:
	- `/ws/chat` solo emitía tokens de texto y no integraba `SentenceChunker` ni la síntesis concurrente de fragmentos oracionales en streaming.
- **Solución**:
	- `services/sentence_chunker.py`: ampliados los delimitadores para incluir comas, puntos y comas y dos puntos (`re.compile(r'([.!?,;:\n]+)')`) con un umbral de activación de `min_words=2`.
	- `interface/backend/routes/call_ws.py`: en `@router.websocket("/ws/chat")` se añadió segmentación al vuelo mediante `SentenceChunker`. Al detectar un signo de puntuación delimitador, se sintetiza inmediatamente el fragmento y se envía al cliente como `audio_chunk` (audio base64 para Piper/RPi5) o `tts_sentence` (para TTS nativo del navegador).
	- `interface/frontend/src/components/ChatView.jsx`: implementada cola de reproducción en streaming (`audioQueueRef`, `browserTtsQueueRef`, Web Audio API) para reproducir progresivamente cada fragmento recibido sin interrupciones, botón "Silenciar" para abortar el habla en cualquier momento e interrupción automática al iniciar un nuevo dictado o enviar mensaje.
	- Recompilado el frontend con `pnpm build`.

### 📝 Registro: [v0.7.39] - Corrección en backend: eliminación de interrupción unilateral de Vosk y sincronización de reproducción
- **date-time**: 2026-10-16 00:36:00
- **Problema**:
	- En `/ws/call`, el backend cancelaba inmediatamente la generación y el habla del asistente en cuanto Vosk detectaba cualquier palabra parcial (`len(text) > 3`), interrumpiendo al modelo de forma prematura y retroalimentando transcripciones fragmentarias al LLM.
- **Causa**:
	- `listen_vosk` en `interface/backend/routes/call_ws.py` contenía una condición de interrupción unilateral sobre transcripciones parciales, asumiendo decisiones de reproducción que corresponden al cliente frontend.
- **Solución**:
	- `interface/backend/routes/call_ws.py`: eliminada la condición de cancelación sobre texto parcial (`elif allow_barge_in and current_task ... and len(text) > 3`), dejando la decisión de parada o interrupción exclusivamente en el frontend a través de mensajes `interrupt` o frases finales (`is_final`).
	- Añadido manejador del evento `playback_status` para que el cliente notifique cuando la reproducción física de audio en altavoces está activa (`is_assistant_busy`), respetando el silenciamiento estricto cuando `allow_barge_in` esté desactivado.
	- Descartada por completo cualquier comparación de texto artificial.
	- Incrementada la versión a `v0.7.39` en `project_status.md`.