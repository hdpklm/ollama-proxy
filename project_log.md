

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

### 📝 Registro: [v0.7.40] - Implementación de 3 Modos de Cancelación de Eco (AEC) y Calibración Acústica
- **date-time**: 2026-10-16 00:55:00
- **Problema**:
	- En llamadas continuas de voz en streaming, el audio emitido por los altavoces se retroalimentaba al micrófono provocando un bucle de eco infinito. La cancelación nativa de Web Audio fallaba por enrutamiento a playCtx.destination y falta de sincronización de retardos.
- **Causa**:
	- En navegadores Chromium, la API Web Audio desconecta la referencia interna de AEC del hardware cuando se reproduce en nodos personalizados. Además, la estimación del retardo entre altavoz y micrófono en WebAssembly (AEC3) tarda varios segundos en converger sin una calibración inicial de latencia física.
- **Solución**:
	- `interface/frontend/src/App.jsx` y `interface/frontend/src/components/SettingsModal.jsx`: añadido selector con 3 modos de AEC configurables:
		1. Modo 1 (Nativo): Reproducción vía `HTMLAudioElement` (`new Audio(blobUrl)`) conectada al sink nativo del sistema, eliminando el compresor agresivo del micrófono para permitir al AEC hardware de Android/Chromium aislar la voz.
		2. Modo 2 (Híbrido): `HTMLAudioElement` + `@ricky0123/vad-web` (Silero VAD en WASM offline). Discrimina si el audio entrante es voz humana y bloquea el micrófono mientras el altavoz suena a menos que el usuario hable.
		3. Modo 3 (Avanzado): `@ennuicastr/webrtcaec3.js` en WASM con análisis de referencia de audio y procesador AEC3, complementado con un tono de calibración acústico inicial para medir la latencia física de la sala y fijar `setAudioBufferDelay`.
	- Copiados los artefactos estáticos de VAD (`silero_vad_v5.onnx`, `vad.worklet.bundle.min.js`, onnxruntime wasm) a `public/vad/` y de AEC3 a `public/aec/`.

### 📝 Registro: [v0.7.41] - Restriccion estricta a IPv4 en Docker Compose
- **date-time**: 2026-10-20 19:00:00
- **Problema**:
	- Se requeria que todos los servicios y la red interna de Docker Compose operen exclusivamente sobre IPv4, impidiendo el uso de IPv6 tanto en puertos expuestos en el host como en la comunicacion interna y externa de los contenedores.
- **Causa**:
	- Por defecto, Docker enlaza los puertos publicados (`ports`) en doble pila (`0.0.0.0` y `:::`) y la red bridge puede tener asignacion IPv6 si el daemon esta configurado para ello. Asimismo, los contenedores intentan resolver o rutear trafico IPv6 a menos que se deshabilite explícitamente en el kernel de la red del contenedor.
- **Solución**:
	- En `docker-compose.yml`:
		1. Se fijaron los puertos expuestos con prefijo IPv4 explicito `0.0.0.0:` (`0.0.0.0:8000:8000`, `0.0.0.0:8080:8080`, `0.0.0.0:5000:5000`, `0.0.0.0:2700:2700`), previniendo que `docker-proxy` abra sockets en `[::]`.
		2. Se anadieron sysctls de red a cada contenedor (`net.ipv6.conf.all.disable_ipv6=1` y `net.ipv6.conf.default.disable_ipv6=1`) para deshabilitar la pila IPv6 dentro de los contenedores.
		3. Se configuro `enable_ipv6: false` explicitamente en la definicion de la red bridge `ollama-net`.
	- Actualizada la version a `v0.7.41` en `project_status.md`.

### 📝 Registro: [v0.7.42] - Ajuste de scroll y responsividad movil en modal de ajustes y vistas
- **date-time**: 2026-10-20 19:22:00
- **Problema**:
	- En dispositivos moviles, el modal de configuracion (SettingsModal) excedia la altura de la pantalla ocultando el encabezado (boton de cierre) y el pie (boton Guardar y Cerrar) sin permitir scroll interior.
	- Las vistas de Chat y Call tenian scroll en el body de la pagina, provocando que en Chat colapsara con el scroll propio de la lista de mensajes y que en Call se pudiera desplazar verticalmente la pantalla sin necesidad.
- **Causa**:
	- `SettingsModal` no poseia limite de altura maxima (`max-h`) ni `overflow-y-auto` en el contenedor de opciones, provocando desborde fuera del viewport.
	- El elemento `body` y contenedor raiz tenian `overflow-x: hidden` y `min-h-screen` en lugar de `overflow: hidden`, `overscroll-behavior: none` y `100dvh`.
	- En `ChatView`, el contenedor principal no tenia `min-h-0` ni delimitaba el scroll exclusivamente a la lista de mensajes.
- **Solución**:
	- `interface/frontend/src/index.css` e `index.html`: fijado `overflow: hidden`, `overscroll-behavior: none` y `100dvh` en `html`, `body` y `#root`, eliminando por completo el scroll en el body.
	- `interface/frontend/src/App.jsx`: configurado `h-full h-dvh w-full`, cabecera fija con `flex-shrink-0` y `main` restringido con `min-h-0 overflow-hidden`.
	- `interface/frontend/src/components/SettingsModal.jsx`: estructurado con `max-h-[88dvh] flex flex-col`, cabecera y pie fijos con `flex-shrink-0` y el listado de opciones con `flex-1 min-h-0 overflow-y-auto`.
	- `interface/frontend/src/components/ChatView.jsx`: aislado con `min-h-0 overflow-hidden` y barra de entrada inferior con `flex-shrink-0`, manteniendo el scroll unicamente en la lista de mensajes.
	- `interface/frontend/src/components/CallView.jsx` y `AudioVisualizer.jsx`: restringidos con `overflow-hidden` y dimensiones responsivas optimizadas para pantallas moviles.
	- Incrementada la version a `v0.7.42` en `project_status.md`.

### 📝 Registro: [v0.7.43] - Inyeccion de marca temporal (timestamp Europe/Madrid) en mensajes de usuario
- **date-time**: 2026-10-20 19:30:00
- **Problema**:
	- El modelo LLM no tenia contexto temporal exacto (dia de la semana, fecha, hora y zona horaria local) al recibir las preguntas del usuario tanto en llamada de voz como en chat.
- **Causa**:
	- Los turnos de conversacion del usuario se enviaban como texto sin procesar sin metadatos temporales anexados.
- **Solución**:
	- En `interface/backend/routes/call_ws.py`:
		1. Se implemento la funcion `stamp(text: str)` utilizando `datetime.now(ZoneInfo("Europe/Madrid"))` con formato `[{now:%A %Y-%m-%d %H:%M} {now.tzname()}]\n{text}` y fallback seguro ante ausencias de tzdata.
		2. En el manejador de llamada por voz (`/ws/call`), dentro de `run_assistant_pipeline`, se transformo el append del historial: `messages.append({"role": "user", "content": stamp(user_text)})`.
		3. En el WebSocket de chat (`/ws/chat`), se anadio el formateo automatico con `stamp(user_text)` a los mensajes con rol `user` antes de remitirlos al streaming del LLM.
	- En `interface/backend/routes/chat.py`: se incorporo la transformacion con `stamp` en el endpoint REST `/api/chat`.
	- Actualizada la version a `v0.7.43` en `project_status.md`.

### 📝 Registro: [v0.8.0] - Microservicio Web-Tools (Parallel/DDG, Reader & PDF to Markdown), Redis RAG y Prompt Markdown
- **date-time**: 2026-10-20 20:00:00
- **Problema**:
	- Se requeria inyectar un system prompt predeterminado en Markdown si los mensajes no traen uno, evitando instrucciones obvias o redundantes sobre la hora.
	- Se necesitaba dotar al sistema de busqueda en linea (con soporte de Parallel API mediante API Key y fallback a DuckDuckGo), lectura/extraccion de articulos web a Markdown y conversion de documentos PDF a Markdown, todo en un contenedor Docker modular por categorias, junto con cache RAG en Redis para acelerar consultas.
- **Causa**:
	- El backend de interfaz no disponia de herramientas de navegacion o extraccion de fuentes externas ni de un servicio de persistencia en cache para consultas recurrentes.
- **Solución**:
	- Creado `interface/backend/system_prompt.md` e integrado en `config.py` (`load_default_system_prompt`, `ensure_system_prompt`) para inyeccion automatica al inicio de la conversacion.
	- Creado el microservicio desacoplado `dockers/web-tools`:
		- `main.py`: expone endpoints `/search` (con soporte para Parallel API con header `x-api-key` y fallback a DuckDuckGo), `/read` (extraccion de paginas web a Markdown limpio usando `trafilatura` y `markdownify`) y `/pdf` (extraccion de paginas PDF a Markdown estructurado con `pypdf`).
		- `Dockerfile` y `pyproject.toml` propios ejecutandose en el puerto 7000.
	- Actualizado `docker-compose.yml`:
		- Anadidos los servicios `web-tools` y `redis` (`redis:7-alpine`) en la red interna `ollama-net` con IPv4 pura y `enable_ipv6: false`.
		- Anadido volumen `redis-data`.
	- En `interface/backend`:
		- `services/rag_service.py`: cache asincrona sobre Redis con fallback en memoria local.
		- `services/web_tools_client.py`: cliente de busqueda, lectura web y PDF con cache RAG integrada.
		- `routes/web_tools.py`: endpoints REST `/api/tools/search`, `/api/tools/read` y `/api/tools/pdf`.
		- Integrado grounding reactivo en `routes/call_ws.py` y `routes/chat.py` para enriquecer automaticamente las consultas con contexto web o PDF cuando se incluyan URLs o intencion de busqueda.
	- Actualizados `build.bat` y `send.bat` con la opcion `[w]` para compilar y transferir `web-tools:latest` a la RPi5.
	- Incrementada la version a `v0.8.0` en `project_status.md`.

### 📝 Registro: [v0.8.1] - Tool-calling autonomo para el LLM, RAG vectorial con metadatos en Redis Stack y desacople de API Key Parallel
- **date-time**: 2026-10-20 20:55:00
- **Problema**:
	- El volumen de persistencia de Redis utilizaba un volumen con nombre en Docker Compose en lugar del directorio compartido del host `/docker/storage/redis`.
	- Los prompts del sistema (tanto en `system_prompt.md` como en el fallback de `config.py`) no incluian los esquemas de herramientas para tool-calling.
	- El cliente `WebToolsClient` inyectaba la clave de API de Parallel indebidamente en peticiones de lectura de paginas web (`/read`) y procesamiento de PDF (`/pdf`).
	- El servicio RAG en Redis solo actuaba como cache clave-valor simple sin capacidades de busqueda vectorial ni metadatos.
	- La orquestacion de herramientas en `call_ws.py` y `chat.py` interceptaba cadenas con palabras clave tipo C++ (`busca `, `búscame `) y expresiones regulares en lugar de permitir que el LLM detectase y decidiese autonomamente cuando llamar a una herramienta.
- **Causa**:
	- Implementacion preliminar con interceptacion heuristica de texto del usuario previa a la inferencia del modelo y configuracion de Redis 7 estándar sin modulo RediSearch.
- **Solución**:
	- `docker-compose.yml`: Se actualizo la imagen de Redis a `redis/redis-stack-server:latest`, se mapeo el volumen directamente a `/docker/storage/redis:/data` y se eliminaron los volumenes nombrados de la raiz.
	- `system_prompt.md` y `config.py`: Se definieron formalmente las especificaciones y firmas de herramientas (`search_web`, `read_url`, `read_pdf`) bajo el formato estructurado `<tool_call>{"name": "...", "arguments": {...}}</tool_call>`.
	- `services/web_tools_client.py`: Se elimino el paso de `x-api-key` en `/read` y `/pdf`, restringiendo la clave de Parallel exclusivamente a `/search`.
	- `services/rag_service.py`: Se implemento el indice RediSearch `idx:rag` con campos `TAG` (`url`, `source`), `TEXT` (`content`, `title`), `NUMERIC` (`timestamp`) y busqueda vectorial KNN (`HNSW`, `FLOAT32`, `COSINE`), con embeddings locales de 128 dimensiones normalizados e indexacion automatica de documentos consultados.
	- `services/tool_executor.py`, `routes/call_ws.py` y `routes/chat.py`: Se elimino toda heuristica rigida basada en palabras clave. Se implemento un bucle agentico autonomo que detecta cuando el LLM emite `<tool_call>`, ejecuta la herramienta correspondiente, realimenta la conversacion con los resultados como observacion y sintetiza la respuesta final grounded sin interrumpir la emision hacia TTS.

### 📝 Registro: [v0.8.2] - Correccion de parser de argumentos polimorficos en tool_executor y supresion de fuga de tags tool_call a TTS
- **date-time**: 2026-10-20 21:50:00
- **Problema**:
	- Durante la invocacion de herramientas (`search_web`), el modelo emitio `"arguments": "tiempo mañana en barcelona"` en formato cadena plana en lugar de un diccionario `{"query": "..."}`. Esto causo una excepcion no controlada: `'str' object has no attribute 'get'`.
	- Los tokens correspondientes al bloque `<tool_call>` se filtraban al flujo de salida de texto y al segmentador de oraciones del sintetizador de voz, provocando que el navegador y el TTS pronunciasen en voz alta fragmentos de codigo JSON y etiquetas de tool-calling (`"<tool_call>\n{\"name\":"`).
- **Causa**:
	- `execute_tool()` en `tool_executor.py` asumia estrictamente que `arguments` era siempre un diccionario invocando `.get()`.
	- En `call_ws.py`, el flag de streaming activaba el envio continuo de tokens hacia el cliente y el `SentenceChunker` sin silenciar la subsecuente aparicion de bloques de herramientas.
- **Solución**:
	- `services/tool_executor.py`: Se implemento extraccion polimorfica de argumentos (`_extract_query` y `_extract_url`) soportando cadenas directas, diccionarios con claves variadas (`query`, `q`, `location`, etc.) y formatos simplificados, eliminando cualquier riesgo de error por tipo.
	- `routes/call_ws.py`: Se añadio filtrado y supresion estricta en `run_assistant_pipeline` y `stream_tokens` para que cualquier token perteneciente a `<tool_call` sea interceptado sin enviarse jamas al `SentenceChunker` ni como token de chat visible al usuario.
	- `system_prompt.md` y `config.py`: Se reforzo la instruccion del prompt para que el LLM responda exclusivamente con el bloque `<tool_call>` sin preludios conversacionales cuando decida usar herramientas.

### 📝 Registro: [v0.8.3] - Estandarizacion formal de esquemas JSON Schema para tool-calling en system prompt y config
- **date-time**: 2026-10-20 22:17:00
- **Problema**:
	- Las especificaciones de herramientas en `system_prompt.md` y `config.py` utilizaban una sintaxis informal y ambigua con comodines (`<nombre_herramienta>`, `<parametro>`), induciendo a modelos locales como `gemma:e2b` a generar salidas no estructuradas.
- **Causa**:
	- Redacción preliminar no conforme con los esquemas formales JSON Schema que los LLMs modernos esperan para invocación estructurada de funciones.
- **Solución**:
	- `system_prompt.md` y `config.py`: Se reescribieron las definiciones de herramientas (`search_web`, `read_url`, `read_pdf`) utilizando el estándar formal JSON Schema (especificación de tipos, descripciones detalladas y parámetros requeridos), junto con un ejemplo concreto y reglas claras que prohíben texto conversacional previo a la invocación de herramientas.

### 📝 Registro: [v0.9.1] - Preservación estricta de parámetros de Request/Response y preempción de tareas urgentes
- **date-time**: 2026-10-20 22:42:00
- **Problema**:
	- Riesgo de pérdida de características personalizadas en los JSON de entrada y salida (como `priority: true` para preguntas urgentes que pausan la tarea en segundo plano, `fast`, `max_tokens`, `temperature`, `times_paused`, `kv_cache_ram_mb` y métricas TPS) al integrar el tool-calling nativo de OpenAI.
- **Causa**:
	- `LLMClient.chat` normalizaba la respuesta devolviendo únicamente `{"message": msg}` y omitía la propagación de `priority` en las firmas de `stream_chat` y `chat`. Además, en `Scheduler._token_loop` no se incrementaba `times_paused` en la tarea de baja prioridad al ser interrumpida por una urgente.
- **Solución**:
	- `backend/scheduler.py`: Al iniciar una tarea urgente (`current_high`), se incrementa `current_low.times_paused += 1` si había una tarea previa activa.
	- `backend/responses.py`: Se garantiza la inclusión de `priority` y `kv_cache_ram_mb` en todos los chunks SSE de chat y en `collect_body`, así como `times_paused` en el chunk de uso y en la respuesta unificada.
	- `interface/backend/services/llm_client.py`: Se añadieron los parámetros `priority`, `fast`, `max_tokens`, `temperature` en `stream_chat` y `chat`, preservando el objeto de respuesta completo (`priority`, `usage`, `times_paused`, `kv_cache_ram_mb`, `choices`) a la vez que se provee la clave `message`.
	- `interface/backend/routes/chat.py` y `call_ws.py`: Se agregaron los campos opcionales en `ChatRequest` y en el protocolo WebSocket (`/ws/chat`), garantizando que cualquier petición urgente con `priority: true` sea despachada con máxima prioridad y pause de inmediato cualquier generación previa.

### 📝 Registro: [v0.9.2] - Corrección de estampación de fecha/hora en español, directrices de herramientas en prompt y filtrado de eco
- **date-time**: 2026-10-20 23:05:00
- **Problema**:
	- El modelo repetía el encabezado `[Hora local actual del usuario: ...]` al inicio de sus respuestas y preguntaba "¿Podrías confirmar qué día es mañana?" en lugar de calcular la fecha o invocar `search_web`. Además, `system_prompt.md` no estaba montado en el volumen de `interface` en `docker-compose.yml`.
- **Causa**:
	- La estampación generaba fecha en inglés (`Tuesday 2026-10-20 CEST`) provocando ambigüedad en el razonamiento de fechas relativas en español ("mañana"). La plantilla de sistema no indicaba calcular fechas relativas ni consultar herramientas directamente ante preguntas de tiempo/noticias, y el modelo tendía a ecoar el corchete inicial.
- **Solución**:
	- `docker-compose.yml`: Se añadió el montaje de volumen `./interface/backend/system_prompt.md:/app/system_prompt.md`.
	- `system_prompt.md` y `config.py`: Se especificó calcular directamente días relativos (hoy/mañana/ayer) a partir de la fecha dada, prohibir repetir corchetes/encabezados y usar `search_web` directamente sin pedir confirmaciones.
	- `call_ws.py`: Se formateó `stamp` con nombres de día y mes en español (`[Fecha y hora actual: Martes 20 de octubre de 2026, 23:00 CEST]`) y se implementó un filtro que trunca de inmediato cualquier eco de encabezado entre corchetes antes de enviarlo al usuario o al sintetizador TTS.

### 📝 Registro: [v0.9.3] - Activación explícita de tool_choice='auto' para selección nativa de herramientas
- **date-time**: 2026-10-20 23:17:00
- **Problema**:
	- A pesar de enviar `tools`, el modelo no ejecutaba tool calling (`tools_used: []`) y generaba una respuesta estática directamente.
- **Causa**:
	- `llama-cpp-python` requiere explícitamente el parámetro `tool_choice="auto"` junto a `tools` para habilitar el enrutador de funciones y las gramáticas de llamada a herramientas; si `tool_choice` era nulo o no se enviaba, el motor omitía la evaluación de funciones.
- **Solución**:
	- `backend/engine.py`: Se configuró por defecto `extra_params["tool_choice"] = job.body.get("tool_choice") or "auto"` siempre que `tools` esté presente.
	- `interface/backend/services/llm_client.py`: Se inyecta automáticamente `"tool_choice": "auto"` en el payload tanto en `stream_chat` como en `chat`.

### 📝 Registro: [v0.9.3] - Verificación y compatibilidad de tool-calling nativo con Gemma 4 y ejecución en contenedores locales
- **date-time**: 2026-10-21 01:25:00
- **Problema**:
	- Se requería validar en local sobre Docker Desktop si el modelo Gemma 4 en `ollama-proxy` era capaz de ejecutar tool-calling para predecir el tiempo de mañana en Barcelona usando `search_web` sin transferir ni compilar en la Raspberry Pi 5, preservando todos los campos de request (`priority`, `fast`, `max_tokens`, `temperature`, `tools`, `tool_choice`) y response (`priority`, `times_paused`, `kv_cache_ram_mb`, `usage`, métricas TPS y `tools_used`).
- **Causa**:
	- Al ejecutar en Windows bajo emulación QEMU ARM64, la inicialización del modelo y la ingesta de prompts largos con esquemas de herramientas y resultados web toma mayor tiempo de CPU, requiriendo ajustar los timeouts por defecto de HTTP (600s). Adicionalmente, Gemma 4 emite tokens de llamada a función nativos (`<|tool_call>call:func{key:<|"|>val<|"|>}<tool_call|>`) que requerían ser parseados por `tool_executor.py`.
- **Solución**:
	- Se integró en `services/tool_executor.py` la compatibilidad para el formato de tokens de función nativo de Gemma 4 junto con el formato JSON estándar.
	- Se optimizó `routes/chat.py` para suministrar las definiciones de herramientas en el primer turno y acotar los snippets devueltos por `web-tools` a 250 caracteres por resultado (máximo 3 resultados) para proteger la ventana de contexto `n_ctx`.
	- Se verificó que tanto Turn 1 (detección de tool-calling y llamada a `web-tools`) como Turn 2 (síntesis del tiempo en Barcelona con datos reales) responden con código HTTP 200 OK y generan la predicción meteorológica precisa.

### 📝 Registro: [v0.9.4] - Emisión por WebSocket de eventos internos en background (Tool-Calling, Thinking y Debug)
- **date-time**: 2026-10-21 02:05:00
- **Problema**:
	- Se solicitó exponer a través del WebSocket de la interfaz (`/ws/chat` y `/ws/call`) todos los eventos internos que ocurren en background (tokens de tool-calling, tokens de razonamiento/thinking, etapas del ciclo de ejecución y resultados de herramientas) para facilitar el debug en vivo, controlados por una nueva variable en `.env` (`HIDE_BACKGROUND`), con valor por defecto `false` para mostrar todo.
- **Causa**:
	- Previamente, para evitar que el motor TTS intentara leer etiquetas de herramientas o corchetes, el WebSocket silenciaba y descartaba el streaming cuando detectaba etiquetas `<tool_call>` o bloques de razonamiento interno, impidiendo que el cliente o desarrollador observara la secuencia interna.
- **Solución**:
	- Se añadió la variable `HIDE_BACKGROUND=false` en `.env`, `.env.example`, `interface/.env.example` y `docker-compose.yml`, integrada en `Settings` de `interface/backend/config.py`.
	- En `interface/backend/routes/call_ws.py` se implementó la emisión de eventos estructurados (`debug`, `thinking_token`, `thinking_done`, `tool_calling_token`, `tool_calling`, `tool_executing`, `tool_result`), protegiendo al mismo tiempo el sintetizador de voz (TTS) para que no vocalice bloques de control.
	- Se añadió la extracción y propagación de `reasoning_content` en `backend/engine.py`, `backend/responses.py` y `services/llm_client.py`.
	- Se actualizó el manejador de mensajes de `ChatView.jsx` para registrar todos los eventos de fondo.
	- Se verificó la recepción de todos los eventos en vivo mediante una conexión WebSocket directa.

### 📝 Registro: [v0.9.5] - Arquitectura de Adaptadores de Modelos (Model Adapter Pattern) y Limpieza de Parches
- **date-time**: 2026-10-21 02:46:00
- **Problema**:
	- Existían múltiples parches heurísticos dispersos en el código: comprobaciones `startswith("[")` interceptando el streaming de TTS, detección ad-hoc de subcadenas `<tool_call>` en mitad del streaming y duplicación completa de 80 líneas de lógica de tool-calling copiada en `/ws/call`, `/ws/chat` y `routes/chat.py`.
	- Cada familia de modelos (Gemma 4, Qwen, OpenAI estándar) tiene sus propias particularidades sintácticas para tool calls y observaciones de segundo turno, requiriendo un desacoplamiento limpio según su arquitectura.
- **Causa**:
	- Crecimiento orgánico de comprobaciones condicionales y band-aids para soportar distintos formatos directamente en los controladores de rutas.
- **Solución**:
	- Se implementó el Patrón Adaptador en un único módulo centralizado: `interface/backend/services/adapters/`:
		- `BaseModelAdapter`: interfaz abstracta para detección de modelo, tokens de herramientas, extracción unificada de `ToolCallItem` y formateo de observaciones de respuesta.
		- `Gemma4Adapter`: soporte nativo para sintaxis de Gemma 4 (`<|tool_call>`, `<|tool_response>`, etc.).
		- `QwenAdapter`: soporte para delimitadores `<tool_call>` y `<tool_response>`.
		- `StandardOpenAIAdapter`: soporte estándar para tool calls estructurados y rol `tool`.
		- `registry.py`: fábrica `get_adapter(model)` que resuelve dinámicamente el adaptador adecuado.
	- Se refactorizó `services/tool_executor.py` eliminando expresiones regulares legacy y usando un diccionario de registro `TOOL_REGISTRY`, acotando los snippets web para no desbordar la ventana de contexto `n_ctx=2048`.
	- Se eliminó la carpeta duplicada `interface/backend/adapters`, dejando un único punto de verdad en `services/adapters/`.
	- Se unificó el bucle de herramientas en `routes/chat.py` y `routes/call_ws.py` delegando íntegramente en el adaptador.

### 📝 Registro: [v0.9.6] - Sistema de Compilación Dual con Tags 'linux' (AMD64 nativo) y 'RPi5' (ARM64)
- **date-time**: 2026-10-21 02:53:00
- **Problema**:
	- En Docker Desktop sobre Windows/Linux x86_64 las imágenes compiladas con `--platform linux/arm64` se ejecutaban bajo emulación QEMU (`qemu-aarch64`), degradando el rendimiento en hasta un 95% (0.42 tps frente a 10-15 tps nativos).
	- Se solicitó poder compilar las imágenes para Linux local sin emulador y para RPi5 cuando se vayan a desplegar en la Raspberry Pi 5, distinguiendo las versiones mediante tags específicos: `linux` y `RPi5` en lugar del genérico `latest`.
- **Causa**:
	- Los scripts anteriores forzaban de forma estática `--platform linux/arm64` y el tag `:latest`.
- **Solución**:
	- Se actualizó `docker-compose.yml` para consumir `:${IMAGE_TAG:-linux}` en todos los servicios (`ollama-proxy`, `interface`, `piper-tts`, `vosk-stt`, `web-tools`), configurable dinámicamente mediante `IMAGE_TAG` en `.env` (valor por defecto `linux` en PC y `RPi5` en Raspberry Pi 5).
	- Se rediseñó `build.bat` para permitir la selección de plataforma (`linux/amd64` con tag `:linux` o `linux/arm64` con tag `:RPi5`), tanto de forma interactiva como mediante parámetros (`build.bat all linux` o `build.bat all rpi5`).
	- Se creó el script de acceso directo `build-linux.bat` para compilar todo el stack nativo en PC.
	- Se actualizaron `send.bat`, `build-proxy.bat`, `build-interface.bat`, `build-piper.bat`, `build-vosk.bat` y `build-n-send.bat` para compilar y enviar exclusivamente las imágenes etiquetadas como `:RPi5`.

### 📝 Registro: [v0.9.6] - Migracion de Contenedores Emulados ARM64 a Imagenes Nativas Linux x86_64
- **date-time**: 2026-10-21 03:00:00
- **Problema**:
	- Docker Desktop en Windows ejecutaba los contenedores con emulación QEMU ARM64 a una velocidad extremadamente baja (~0.42 t/s).
- **Causa**:
	- Las imágenes compiladas tenían el tag latest y estaban dirigidas exclusivamente a RPi5 (linux/arm64).
- **Solución**:
	- Se separó el etiquetado en `:linux` (para x86_64) y `:RPi5` (para Raspberry Pi 5).
	- Se eliminaron los contenedores antiguos emulados y el contenedor conflictivo `redis`.
	- Se compilaron y ejecutaron todas las imágenes con arquitectura nativa `linux/amd64` (`ollama-proxy:linux`, `interface:linux`, `web-tools:linux`, `piper-tts:linux`, `vosk-stt:linux`).
	- La velocidad de generación aumentó de 0.42 t/s a 15.29 t/s (83.2 prompt t/s), completando el flujo completo de tool calling en 21.5s.

### 📝 Registro: [v0.9.6] - Compilacion de Imagenes para Raspberry Pi 5 con Tag RPi5
- **date-time**: 2026-10-21 03:05:00
- **Problema**:
	- Se requerían las imágenes del stack compiladas específicamente para Raspberry Pi 5 (`linux/arm64`) bajo el tag `:RPi5`.
- **Causa**:
	- Separación de entornos de compilación para evitar conflictos entre la versión nativa de desarrollo en PC (`:linux`) y la versión de producción en ARM64 (`:RPi5`).
- **Solución**:
	- Se compilaron y cargaron en Docker local las 5 imágenes con destino `linux/arm64`: `ollama-proxy:RPi5`, `interface:RPi5`, `piper-tts:RPi5`, `vosk-stt:RPi5` y `web-tools:RPi5`.
	- Se creó el script de acceso directo `build-rpi5.bat` y se integró `web-tools` en `build-n-send.bat`.

### 📝 Registro: [v0.9.7] - Boton de telemetria y visor de herramientas en respuestas del chat
- **date-time**: 2026-10-21 13:55:00
- **Problema**:
	- En la vista de chat (`ChatView.jsx`), los mensajes de respuesta del asistente no disponían de un botón interactivo para consultar las herramientas ejecutadas ni las métricas de rendimiento y velocidad de generación (tokens de prompt, velocidad TPS de prompt, tokens generados y velocidad TPS de generación).
- **Causa**:
	- El cliente WebSocket y el fallback REST recibían los eventos de `tool_calling`, `usage` y `done`, pero no persistían `tools_used` ni `usage` en el estado de cada mensaje del asistente ni contaban con un componente de interfaz para desplegarlos.
- **Solución**:
	- Modificado `interface/frontend/src/components/ChatView.jsx` agregando la captura y persistencia de `tools_used` y `usage` en cada mensaje del asistente (tanto vía `/ws/chat` como en `fallbackFetchChat`).
	- Añadido botón interactivo con icono `Activity` (y contador de tools con `Wrench`) en el footer de cada respuesta del asistente.
	- Creado panel desplegable con diseño moderno que detalla: conteo y velocidad TPS de evaluación de prompt, conteo y velocidad TPS de tokens generados, total de tokens, métricas del scheduler (prioridad y pausas), y lista desglosada de herramientas ejecutadas con sus argumentos.
	- Actualizado `project_status.md` a la versión `v0.9.7`.

### 📝 Registro: [v0.9.8] - Implementacion de Arquitectura de Sub-Agentes Especializados
- **date-time**: 2026-10-21 16:25:00
- **Problema**:
	- El asistente conversacional no disponía de un mecanismo modular para delegar tareas complejas o especializadas (investigación profunda, programación senior o redacción ejecutiva) en sub-agentes independientes con prompts, modelos y temperaturas aisladas.
- **Causa**:
	- El bucle agéntico solo contaba con herramientas de búsqueda web y lectura de documentos (`search_web`, `read_url`, `read_pdf`), sin capacidad de orquestación jerárquica de sub-agentes.
- **Solución**:
	- Creado `interface/backend/services/sub_agents.py` implementando la clase `SubAgent` y un registro desacoplado de sub-agentes preconfigurados: `researcher` (análisis riguroso), `coder` (ingeniería de software y arquitectura) y `writer` (comunicación formal).
	- Extendido `interface/backend/services/tool_definitions.py` para exportar dinámicamente las herramientas nativas de delegación (`delegate_to_researcher`, `delegate_to_coder`, `delegate_to_writer`).
	- Conectado `interface/backend/services/tool_executor.py` para despachar automáticamente las llamadas delegadas a su sub-agente correspondiente vía `SUB_AGENTS`.
	- Actualizado `interface/backend/system_prompt.md` y `interface/backend/config.py` orientando al modelo orquestador a utilizar estas delegaciones cuando la complejidad lo requiera.
	- Adaptado `interface/frontend/src/components/ChatView.jsx` para distinguir visualmente las ejecuciones de sub-agentes con badge e icono de bot en el visor de telemetría y métricas.
	- Actualizado `project_status.md` a la versión `v0.9.8`.

### 📝 Registro: [v0.9.9] - Sistema de Cache Binario en RAM y Disco para System Prompts de Agentes
- **date-time**: 2026-10-21 16:38:00
- **Problema**:
	- Al invocar al agente principal o a sub-agentes en cada consulta, el motor LLM debía re-calcular y evaluar todos los tokens de entrada de la cabecera (system prompt), incrementando la latencia de primer token (TTFT) de forma redundante.
- **Causa**:
	- No existía un mecanismo de persistencia binaria ni precarga en memoria RAM del estado KV-Cache correspondiente a los system prompts de los agentes.
- **Solución**:
	- Creado `backend/prompt_cache.py` con `PromptCacheManager`, el cual serializa el estado KV (`.bin`) indexado por hash SHA256 del contenido del system prompt.
	- Implementada invalidación automática: al cambiar el hash de la cabecera de un agente, se elimina el binario antiguo obsoleto del disco y se genera y persiste el nuevo.
	- Añadida precarga automática a memoria RAM al iniciar el contenedor (`load_all_to_ram` y `warmup_defaults`) para que todos los estados conocidos queden residentes en memoria sin latencia de disco.
	- Integrado en `backend/engine.py` (`create_stream` y `count_prompt_tokens`) restaurando directamente el estado en el contexto (`llm.load_state`), permitiendo omitir la evaluación de la cabecera y calcular únicamente desde los mensajes del usuario en adelante.
	- Actualizado `project_status.md` a la versión `v0.9.9`.

### 📝 Registro: [v0.9.10] - Congelacion y Restauracion de Contexto en RAM al Delegar en Sub-Agentes
- **date-time**: 2026-10-21 16:50:00
- **Problema**:
	- Cuando el agente principal delegaba una tarea en un sub-agente, la ejecución del sub-agente en el contexto LLM sobreescribía el KV-Cache activo del llamador. Al volver el turno al agente principal, este debía re-calcular y re-evaluar todo su historial previo de tokens desde el principio.
- **Causa**:
	- Ausencia de un mecanismo de congelación (snapshot) y restauración inmediata en memoria RAM del estado del contexto del agente llamador durante la delegación en sub-agentes.
- **Solución**:
	- Añadidos métodos `save_snapshot` y `pop_snapshot` en `backend/prompt_cache.py` gestionando la pila de estados en memoria RAM.
	- Implementados `save_context_snapshot` y `restore_context_snapshot` en `backend/engine.py` para capturar y reanudar el KV-Cache en `LlamaEngine`.
	- Expuestos endpoints REST `/v1/context/snapshot/save` y `/v1/context/snapshot/restore` en `backend/routes.py`.
	- Conectado `interface/backend/services/llm_client.py` con métodos asíncronos para solicitar congelación y restauración de snapshots al proxy.
	- Actualizado `SubAgent.run` en `interface/backend/services/sub_agents.py` para congelar el contexto activo del llamador antes de iniciar el sub-agente y restaurarlo inmediatamente en bloque `finally`, permitiendo al agente principal continuar sin re-cálculos de tokens.
	- Actualizado `project_status.md` a la versión `v0.9.10`.

### 📝 Registro: [v0.9.6] - Transferencia Unificada en send.bat con Autenticacion SSH Unica
- **date-time**: 2026-10-21 18:18:00
- **Problema**:
	- `send.bat` ejecutaba una conexión SSH independiente por cada contenedor (`docker save img | ssh ...`), obligando al usuario a introducir la contraseña 5 veces consecutivas.
	- Existían errores de sintaxis en `cmd` debido a caracteres no escapados (`&`, `->`) y saltos de línea LF.
- **Causa**:
	- Diseño secuencial iterativo de `send.bat` que invocaba `ssh` por cada imagen por separado.
- **Solución**:
	- Se refactorizó `send.bat` para acumular todas las imágenes seleccionadas en un único comando `docker save [imgs...] | ssh user@ip "docker load"`.
	- Ahora SSH se ejecuta una sola vez y solicita la contraseña una única vez para todo el conjunto.
	- Se corrigieron los caracteres especiales y se normalizaron todos los `.bat` a CRLF.

### 📝 Registro: [v0.9.11] - Centralizacion de scripts en cmd/ y flujo con Docker Hub local
- **date-time**: 2026-10-22 01:53:00
- **Problema**:
	- Multiplicidad de scripts .bat en la raiz del proyecto y lentitud/inestabilidad de la transferencia directa por pipes SSH (docker save | docker load).
- **Causa**:
	- No existia un directorio unificado de comandos de ciclo de vida ni un mecanismo nativo de distribucion de imagenes por red local LAN.
- **Solución**:
	- Creacion de directorio `cmd/` con los scripts unificados:
		- `setup-hub.bat`: Levanta el contenedor `local-registry` (`registry:2`) en el puerto 5050 del host Windows.
		- `build-rpi5.bat`: Compila las imagenes para `linux/arm64` (:RPi5) y las sube automaticamente al Hub local.
		- `build-linux.bat`: Compila las imagenes nativas para `linux/amd64` (:linux).
		- `load-rpi5.sh`: Script bash para Raspberry Pi 5 que descarga via `docker pull` por LAN, re-etiqueta con nombres limpios y elimina tags del hub.
	- Copia y permisos de ejecucion de `load-rpi5.sh` directamente en la Raspberry Pi 5.
	- Limpieza y eliminacion de todos los `.bat` obsoletos en la raiz del repositorio.

### 📝 Registro: [v0.9.11] - Script de compilacion nativa en RPi5 (build-on-rpi5.sh)
- **date-time**: 2026-10-22 01:59:00
- **Problema**:
	- Se requiere la posibilidad de compilar los contenedores directamente y de forma nativa en la propia Raspberry Pi 5 sin depender del PC.
- **Causa**:
	- Hasta ahora la compilacion ARM64 dependia del emulador buildx del PC o de scripts locales de Windows.
- **Solución**:
	- Creacion de `cmd/build-on-rpi5.sh` con deteccion automatica del directorio raiz, compilacion nativa con tag `:RPi5` para todos los servicios o servicio individual, y despliegue directo con permisos de ejecucion en la RPi5.

### 📝 Registro: [v0.9.12] - Arquitectura de Doble WebSocket en Chat (Streaming + Métricas Granulares por Etapas)
- **date-time**: 2026-10-22 13:38:00
- **Problema**:
	- Al realizar una consulta en la interfaz de chat, la conexión WebSocket única mezclaba la entrega de tokens y telemetría, careciendo de un canal dedicado para desplegar por etapas los resultados de rendimiento: tiempo de carga y estado del modelo en memoria, duración y velocidad TPS de evaluación del prompt, métricas aisladas para cada sub-agente, tiempo de restauración del KV-Cache de sesión y su peso en RAM, y duración con desglose de tokens (petición de agente, respuesta de función y total) para cada tool-calling.
- **Causa**:
	- Ausencia de un canal de eventos y métricas no-streaming desacoplado del stream de tokens y síntesis TTS, así como falta de recolección y emisión estructurada de telemetría de modelos, snapshots KV, sub-agentes y conteo de tokens de herramientas.
- **Solución**:
	- Creado `TurnMetricsManager` y nuevo endpoint `[WS] /ws/chat/metrics` en `interface/backend/routes/call_ws.py`, desacoplando la emisión de telemetría de `/ws/chat` (dedicado exclusivamente a tokens en tiempo real y audio TTS).
	- Implementada la captura y emisión en vivo de las 5 métricas requeridas:
		1. Carga del modelo (`model_load`): nombre del modelo, estado en memoria RAM mmap y tiempo de carga.
		2. Evaluación del prompt (`prompt_execution`): conteo de tokens, tiempo de ejecución y velocidad TPS.
		3. Telemetría de sub-agentes (`sub_agent`): métricas completas independientes (prompt, generación, tiempos, TPS y restore KV/RAM).
		4. Restauración de sesión y KV-cache (`kv_cache`): tiempo de restauración y peso en RAM (MB).
		5. Tool-calling detallado (`tool_execution`): tiempo de ejecución de la función, tokens de la llamada del agente, tokens de la respuesta de la función y total acumulado.
	- Añadido endpoint `/v1/tokenize` y enriquecidos endpoints `/v1/models` y `/v1/context/snapshot/restore` en `backend/routes.py`, `backend/engine.py`, `backend/scheduler.py` y `backend/responses.py`.
	- Actualizado `interface/backend/services/sub_agents.py` y `interface/backend/services/tool_executor.py` para medir y emitir métricas en cada delegación.
	- Modificado `interface/frontend/src/components/ChatView.jsx` para inicializar en paralelo ambos WebSockets (`/ws/chat` y `/ws/chat/metrics?turn_id=...`), y rediseñado el visor desplegable de "Métricas" con tarjetas estructuradas para cada etapa y sub-agente.


### 📝 Registro: [v0.9.13] - Modal y telemetria de memoria RAM en tiempo real para el Proxy LLM
- **date-time**: 2026-10-22 18:35:00
- **Problema**:
	- Se solicitó visualizar en un popup interactivo la memoria RAM exacta consumida por el proxy LLM, desglosando el modelo base original, todos los prompt caches pre-calentados y todos los temporal snapshots de sub-agentes, accesible junto al botón de configuración.
- **Causa**:
	- No existía un endpoint de telemetría de memoria ni un componente visual en el frontend web para consultar el consumo de RAM en tiempo real.
- **Solución**:
	- `backend/prompt_cache.py`: Método `get_memory_breakdown()` que computa el desglose de tokens y memoria de cada caché permanente y snapshot temporal en RAM.
	- `backend/engine.py`: Método `get_memory_stats()` que agrupa memoria RSS/VMS del proceso del sistema, tamaño y parámetros del modelo base GGUF, contextos KV activos (High/Low) y prompt/temporal caches.
	- `backend/routes.py`: Endpoints `/v1/system/memory` y `/api/system/memory`.
	- `interface/backend/main.py`: Endpoint `/api/proxy/memory` que conecta con el proxy.
	- `interface/frontend/src/components/MemoryModal.jsx`: Modal con diseño oscuro pulido, auto-refresco y desglose por tarjetas (RAM RSS, Modelo GGUF, Contextos KV, Prompt Caches por agente y Snapshots temporales).
	- `interface/frontend/src/App.jsx`: Botón con icono de actividad al lado del botón de configuración de voz.

### 📝 Registro: [v0.9.14] - Corrección de SyntaxError en backend/engine.py y restauración de servicio ollama-proxy
- **date-time**: 2026-10-22 18:48:30
- **Problema**:
	- Al consultar el endpoint `/api/proxy/memory` o pulsar el botón de memoria RAM en la interfaz web, el sistema devolvía `{"status":"error","message":"[Errno -2] Name or service not known"}`.
- **Causa**:
	- En `backend/engine.py`, el método `restore_context_snapshot` contenía un bloque `try:` sin bloque `except`/`finally` correspondiente, generando un `SyntaxError: expected 'except' or 'finally' block`.
	- Esto impedía que el proceso Uvicorn de `ollama-proxy` iniciase en el contenedor, quedando en estado de bucle `Restarting (1)`. Al no estar activo el contenedor, el DNS interno de Docker (`ollama-net`) no podía resolver el nombre de host `ollama-proxy`, provocando la excepción `[Errno -2] Name or service not known` en el backend de la interfaz.
- **Solución**:
	- Se corrigió `backend/engine.py` completando el bloque `try/except Exception as e:` y retornando `True` tras cargar el estado del contexto.
	- Se verificó la sintaxis de todos los archivos modificados con `py_compile`.
	- Se sincronizaron los archivos corregidos hacia la Raspberry Pi 5 y se reiniciaron los contenedores `ollama-proxy` e `interface`.
	- Se validó el endpoint `/api/proxy/memory` verificando la entrega correcta del desglose de memoria RAM (proceso RSS/VMS, modelo base en MB/GB, contextos KV y prompt caches precalentadas).

### 📝 Registro: [v0.9.15] - Centralización de system prompts en carpeta raíz /prompts
- **date-time**: 2026-10-23 01:21:40
- **Problema**:
	- Los system prompts se encontraban dispersos e inconsistentes: el prompt principal estaba en `interface/backend/system_prompt.md` (con fallbacks en código en `config.py` y `prompt_cache.py`), mientras que los prompts de sub-agentes (`researcher`, `coder`, `writer`) estaban definidos como cadenas de texto fijas en `interface/backend/services/sub_agents.py` y replicados en `backend/prompt_cache.py`.
- **Causa**:
	- Crecimiento modular sin una carpeta centralizada compartida para todas las directrices de los agentes y sub-agentes del sistema.
- **Solución**:
	- Se creó el directorio centralizado [`prompts/`](file:///c:/work/person/hassan/Repos/ollama-proxy/prompts/) en la raíz del repositorio con los archivos Markdown:
		- `prompts/system_prompt.md`: Directivas del asistente conversacional principal.
		- `prompts/researcher.md`: Directivas del sub-agente investigador.
		- `prompts/coder.md`: Directivas del sub-agente programador.
		- `prompts/writer.md`: Directivas del sub-agente redactor.
	- `interface/backend/config.py`: Se implementaron `get_prompts_dir()` y `load_prompt(name)` para localizar y cargar dinámicamente cualquier prompt desde `prompts/` con fallback de compatibilidad.
	- `interface/backend/services/sub_agents.py`: Se adaptó la clase `SubAgent` para cargar dinámicamente el prompt Markdown en tiempo de ejecución.
	- `backend/prompt_cache.py`: Se implementó `load_all_agent_prompts()` para descubrir e indexar automáticamente todos los archivos de prompt existentes en `prompts/` y pre-calentar sus cachés KV en RAM.
	- `docker-compose.yml`: Se añadió el montaje de volumen `./prompts:/app/prompts:ro` tanto en el servicio `ollama-proxy` como en `interface`.
	- Se desplegaron los cambios en la Raspberry Pi 5 y se verificó la recarga en caliente de los prompts y su pre-calentamiento en RAM.

### 📝 Registro: [v0.9.16] - Sistema PRO de asignación de herramientas, directivas contextuales y guardrails vía YAML Frontmatter
- **date-time**: 2026-10-23 02:16:30
- **Problema**:
	- No existía una forma modular y declarativa en `prompts/` para asignar herramientas específicas a cada sub-agente y al agente principal, contextualizar su propósito para cada rol o restringir su uso para evitar abusos y bucles infinitos.
- **Causa**:
	- Las herramientas estaban agrupadas en un esquema estático global (`NATIVE_TOOLS`) asignado por defecto únicamente al agente principal, mientras que los sub-agentes no disponían de un bucle autónomo para ejecutar herramientas autorizadas.
- **Solución**:
	- **YAML Frontmatter en Markdown**: Se estandarizó la cabecera YAML en cada archivo de `prompts/*.md` (`system_prompt.md`, `researcher.md`, `coder.md`, `writer.md`) definiendo `name`, `role`, `temperature`, `tools`, `max_calls`, `purpose` y `rules`.
	- **Módulo `AgentProfile` y `AgentManager`**: Creado [`interface/backend/services/agent_manager.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/services/agent_manager.py) para parsear el frontmatter, filtrar esquemas de herramientas y generar el prompt efectivo con directivas contextuales inyectadas.
	- **Guardrails en `ToolExecutor`**: [`interface/backend/services/tool_executor.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/services/tool_executor.py) ahora valida autorización por rol y bloquea con error pedagógico si se excede el límite de llamadas fijado en el frontmatter (`can_execute_tool`).
	- **Bucle autónomo en Sub-Agentes**: [`interface/backend/services/sub_agents.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/services/sub_agents.py) ahora ejecuta hasta 3 pasos de tool-calling si el sub-agente invoca herramientas autorizadas (ej. `researcher` buscando y leyendo URLs).
	- **Sincronización de PromptCache**: [`backend/prompt_cache.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/backend/prompt_cache.py) procesa el frontmatter e indexa exactamente los mismos prompts efectivos para pre-calentamiento KV en memoria RAM.
	- Se añadieron tests exhaustivos en `LLM_Test/gemini/tests/test_agent_tools.py` y se desplegó y validó en la Raspberry Pi 5.

### 📝 Registro: [v0.9.17] - Modularización de herramientas en paquete tools/ por categorías con handlers vinculados
- **date-time**: 2026-10-23 02:27:40
- **Problema**:
	- Las funciones ejecutoras de herramientas y sus esquemas OpenAI estaban dispersos en `tool_executor.py` y `tool_definitions.py` sin una categorización modular ni un enlace directo entre la especificación JSON y la función ejecutora.
- **Causa**:
	- Crecimiento orgánico donde las funciones auxiliares se acumulaban en servicios individuales sin un paquete unificado de herramientas.
- **Solución**:
	- Se creó el paquete modular [`interface/backend/tools/`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/tools/) categorizado:
		- [`tools/web.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/tools/web.py): Herramientas web (`search_web`, `read_url`, `read_pdf`), conteniendo sus funciones y exportando el diccionario `TOOLS` con cada esquema vinculado a su `handler`.
		- [`tools/delegation.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/tools/delegation.py): Herramientas de sub-agentes (`delegate_to_researcher`, `delegate_to_coder`, `delegate_to_writer`) con esquema y `handler` ejecutable.
		- [`tools/__init__.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/tools/__init__.py): Registro consolidado `TOOL_REGISTRY`, filtrado contextual por agente y despachador `execute_tool` con guardrails.
	- [`services/tool_definitions.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/services/tool_definitions.py) y [`services/tool_executor.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/interface/backend/services/tool_executor.py) ahora reexportan limpiamente desde `tools/`.
	- [`docker-compose.yml`](file:///c:/work/person/hassan/Repos/ollama-proxy/docker-compose.yml): Añadido el volumen `- ./interface/backend/tools:/app/tools`.
	- Creados tests en `LLM_Test/gemini/tests/test_tools_package.py` y desplegado en la Raspberry Pi 5.

### 📝 Registro: [v0.9.18] - Memoria Jerárquica en Árbol (TreeNode), Mata-Silencio de Cero Coste y Plan-and-Solve con Caché Limpia
- **date-time**: 2026-10-23 04:35:00
- **Problema**:
	- Crecimiento desmedido de contexto y saturación cuadrática O(N^2) en conversaciones extensas, latencia de silencio durante invocación de herramientas, y pérdida de datos concretos al resumir solicitudes multi-paso complejas.
- **Causa**:
	- Ausencia de estructuración jerárquica de temas en el RAG, ausencia de ventana deslizante estricta con desruidado, falta de avisos inmediatos al despachar llamadas a herramientas y acumulación indiscriminada de tokens entre tareas.
- **Solución**:
	- Creado `interface/backend/services/tree_context_manager.py`: Estructura `TreeNode` en 3 niveles con proyección dinámica de contexto (tema activo expandido y temas inactivos colapsados en 1 línea), soporte de ramas de chat (`branches`), ventana fija de 10 mensajes (5 turnos de usuario + 5 de asistente) y desruidado automático cada 5 turnos.
	- Creado `interface/backend/services/silence_killer.py`: Formateo en tiempo real de feedback al usuario (< 10 palabras) extrayendo directamente los argumentos de invocación de tools sin generar inferencias duplicadas ni coste de tokens.
	- Creado `interface/backend/services/plan_and_solve.py`: Detector condicional de peticiones complejas, desglose estructurado en diccionario de tareas, ejecución aislada con contexto limpio por tarea en modo secuencial para RPi5 y síntesis exhaustiva que preserva todos los datos clave.
	- Integrados los nuevos servicios en `routes/call_ws.py` (/ws/chat y /ws/call) y `routes/chat.py` (/api/chat).

### 📝 Registro: [v0.9.19] - Auditoría y Persistencia de Logs en Markdown Categorizados para Inspección Web
- **date-time**: 2026-10-23 04:55:00
- **Problema**:
	- Falta de trazabilidad y observabilidad del estado exacto de la memoria entregada al LLM (system prompt, árbol RAG y últimos 10 mensajes), sin registro individual indexado de invocaciones a tools ni ejecuciones de subagentes para consulta web.
- **Causa**:
	- Los logs anteriores eran efímeros en stdout/WebSocket o métricas agregadas de telemetría sin almacenamiento persistente ni visualización desglosada por sesión y archivo.
- **Solución**:
	- Creado `interface/backend/services/conversation_logger.py`: Motor de guardado estructurado en carpetas `{yyyy-mm-dd--hh-mm}-{nombre}` con archivos indexados `{index:03d}-{tipo}.md` y frontmatter YAML categorizado (`user_turn`, `tool_call`, `agent_execution`, `plan_step`).
	- `{index}-user.md` almacena con precisión quirúrgica el estado de la memoria en ese turno: System Prompt efectivo, memoria RAG en Árbol (TreeNode), últimos 10 mensajes (5 del usuario + 5 del asistente), la consulta del usuario y la respuesta final del LLM.
	- Creado `interface/backend/routes/logs.py` y montado en `main.py` con endpoints REST (`GET /api/logs/conversations`, `GET /api/logs/conversations/{session_dir}`, `GET /api/logs/conversations/{session_dir}/{filename}`) con soporte de filtrado por categoría para la interfaz web.
	- Integrada la auditoría en `routes/call_ws.py`, `routes/chat.py` y `services/sub_agents.py`.

### 📝 Registro: [v0.9.20] - Visor Web Interactivo de Historial con Slider de Sesiones y Acordeón de Razonamiento
- **date-time**: 2026-10-23 05:07:00
- **Problema**:
	- Los logs de auditoría en Markdown almacenados en el backend no contaban con un componente visual en la aplicación web para permitir al usuario explorar sesiones anteriores ni inspeccionar de forma desglosada el flujo de memoria, tools y razonamiento por mensaje.
- **Causa**:
	- Ausencia de interfaz interactiva en el frontend React conectada a los endpoints `/api/logs/conversations`.
- **Solución**:
	- Creado `interface/frontend/src/components/HistoryModal.jsx`: Modal interactivo que cuenta con un slider lateral izquierdo scrollable con buscador de conversaciones (`GET /api/logs/conversations`), y un cuerpo principal que muestra los mensajes de usuario agrupados por turno. Cada mensaje funciona como un acordeón desplegable que expone: (1) memoria RAG activa en árbol (`TreeNode`), últimos 10 mensajes y system prompt; (2) llamadas intermedias a herramientas (`tool_call`), sub-agentes (`agent_execution`) y pasos de planes multi-paso (`plan_step`); y (3) la respuesta final emitida por el LLM.
	- Integrado botón de acceso con icono `History` en la cabecera principal de `interface/frontend/src/App.jsx`.

### 📝 Registro: [v0.9.22] - Corrección de Scroll en Detalles de Mensajes del Historial Web (HistoryModal)
- **date-time**: 2026-10-23 05:28:00
- **Problema**:
	- En el modal de historial de conversaciones (`HistoryModal.jsx`), al abrir el acordeón de un mensaje para ver los detalles (memoria TreeNode RAG, últimos 10 mensajes, system prompt y herramientas utilizadas), el scroll vertical no funcionaba y quedaba bloqueado o inactivo.
- **Causa**:
	- La propiedad CSS `overscroll-contain` en los contenedores `<pre>` y `<div>` de los detalles capturaba y descartaba los eventos de la rueda del ratón (*mouse wheel*), impidiendo la propagación (*scroll chaining*) hacia el contenedor principal `<main>`.
	- En la estructura flexbox del modal, el contenedor del diálogo usaba `h-full max-h-[92vh]`, lo que en algunos navegadores resolvía `height: 100%` a `auto` dentro de un contenedor flex, expandiendo `<main>` a la altura total de su contenido sin disparar el scrollbar interno y quedando cortado por el `overflow-hidden` del diálogo.
- **Solución**:
	- En `interface/frontend/src/components/HistoryModal.jsx`:
		- Se fijó la altura del diálogo modal de forma determinista con `h-[90vh] sm:h-[90dvh]` y se agregó `h-full min-h-0` al contenedor dividido (`flex-col md:flex-row`).
		- Se eliminó `overscroll-contain` de `<main>` y de todos los bloques internos (`<pre>` y `<div>` de RAG, 10 mensajes, system prompt y ejecuciones de herramientas), permitiendo que el desplazamiento con rueda fluya con total naturalidad sin atrapar el cursor.
		- Se ajustaron las alturas máximas de los bloques a `max-h-96 overflow-y-auto` con soporte de `break-words whitespace-pre-wrap` y scrollbar estilizado para una lectura cómoda y sin cortes.

### 📝 Registro: [v0.9.23] - Enrutamiento de Logs de Conversaciones a Raíz del Proyecto y Mapeo en Docker
- **date-time**: 2026-10-23 05:33:00
- **Problema**:
	- Los logs de auditoría de conversaciones y razonamiento no aparecían en la carpeta física de la raíz del proyecto (`logs/conversations`) al ejecutarse dentro del contenedor Docker en la Raspberry Pi 5 ni en entornos locales.
- **Causa**:
	- En `interface/backend/services/conversation_logger.py`, la ruta por defecto resolvía dos niveles arriba (`interface/logs/conversations`) en lugar de la raíz del repositorio (`logs/conversations`).
	- En `docker-compose.yml`, el servicio `interface` no tenía un volumen montado para `./logs`, por lo que el contenedor escribía los archivos en su capa efímera interna sin persistirlos en el disco del host.
- **Solución**:
	- Se modificó `interface/backend/services/conversation_logger.py` para resolver dinámicamente la raíz del proyecto (`./logs/conversations`) comprobando la existencia de `docker-compose.yml` / `project_status.md` a 3 niveles, `/app/logs/conversations` en contenedores, o la variable `CONVERSATION_LOGS_DIR`.
	- Se añadió el volumen `- ./logs:/app/logs` en `docker-compose.yml` dentro del servicio `interface`, garantizando que todas las sesiones y archivos Markdown de auditoría generados por el LLM se sincronicen directamente en la raíz física del host.

### 📝 Registro: [v0.9.24] - Recreación de Contenedor Interface en RPi5 y Persistencia de Logs en Host
- **date-time**: 2026-10-23 05:58:00
- **Problema**:
	- Tras ejecutar `git pull && docker compose restart` en la Raspberry Pi 5, las carpetas de logs de conversaciones seguían sin generarse en el host (`/docker/repos/ollama-proxy/logs`), manteniéndose exclusivamente dentro del contenedor.
- **Causa**:
	- `docker compose restart` únicamente reinicia los procesos en contenedores ya instanciados; no reconstruye ni actualiza la definición de montajes de volúmenes de `docker-compose.yml`. El contenedor `interface` seguía corriendo con la configuración creada horas atrás sin el bind mount `- ./logs:/app/logs`.
	- Al intentar recrear el contenedor mediante `docker compose up -d interface`, el comando fallaba con `No such image: interface:linux` debido a que la variable `IMAGE_TAG` no estaba definida en el `.env` de la RPi5, intentando descargar la imagen x86 (`:linux`) en vez de la ARM64 local (`:RPi5`).
- **Solución**:
	- Se rescataron todas las sesiones de logs existentes desde el interior del contenedor hacia el host físico (`docker cp interface:/app/logs .`).
	- Se fijó `IMAGE_TAG=RPi5` en `/docker/repos/ollama-proxy/.env` en la Raspberry Pi 5.
	- Se recreó el contenedor con `docker compose up -d interface`, activando el bind mount `{"Source":"/docker/repos/ollama-proxy/logs","Destination":"/app/logs"}`.
	- Se comprobó el acceso de lectura y escritura bidireccional entre contenedor y host, y se validó que la API `/api/logs/conversations` sirve correctamente las 4 sesiones existentes.

### 📝 Registro: [v0.9.25] - Persistencia de sesión única por chat e indexación incremental sin colisión
- **date-time**: 2026-10-23 10:10:00
- **Problema**:
	- Al escribir mensajes adicionales dentro del mismo chat, el sistema generaba una carpeta nueva cada vez ({yyyy-mm-dd--hh-mm}-{slug}) en lugar de conservar todos los turnos, llamadas a tools y sub-agentes en la misma carpeta del chat, provocando dispersión de logs y riesgo de pérdida de contexto cronológico.
- **Causa**:
	- ChatView.jsx no conservaba ni transmitía un identificador de sesión (session_id) al WebSocket (/ws/chat) ni al endpoint REST (/api/chat).
	- En el backend, el mapeo de carpetas de sesión solo existía en memoria volátil de proceso y no se recuperaba tras reinicio o recarga, además de que sub_agents.py hardcodeaba session_id="sub_agents" aislándose de la conversación madre.
- **Solución**:
	- Se añadió en conversation_logger.py persistencia bidireccional de sesiones en disco (.sessions_map.json y .session_meta.json por carpeta) con auto-recuperación ante reinicios y cálculo dinámico del siguiente índice (_get_highest_index(folder_path) + 1), garantizando que cada archivo (001-user.md, 002-tool-*.md, etc.) tenga numeración estrictamente creciente sin colisiones.
	- Se actualizó interface/backend/routes/chat.py para admitir session_id en ChatRequest y propagar la sesión activa mediante set_active_session.
	- En interface/frontend/src/components/ChatView.jsx, se implementó persistencia de chatSessionId vía sessionStorage, inclusión de session_id en los payloads de WebSocket y fallback REST, y botón de "Nuevo chat" para reiniciar limpiamente la sesión cuando el usuario lo desee.
	- Se crearon pruebas unitarias exhaustivas en LLM_Test/gemini/tests/test_conversation_logger.py validando la persistencia en una única carpeta tras múltiples turnos de usuario, tools, sub-agentes y reinicio simulado del backend.

### 📝 Registro: [v0.9.26] - Precalentamiento de System Prompts formateados para chat y reuso de prefijo KV sin reevaluación
- **date-time**: 2026-10-24 03:26:00
- **Problema**:
	- Latencia elevada (~14.5 segundos) hasta la emisión del primer token (TTFT) en cada turno de conversación debido a la re-evaluación completa de los cientos de tokens del system prompt y esquemas de tools en CPU.
- **Causa**:
	- En `call_ws.py` y `chat.py`, el árbol de notas y memoria dinámica (`tree_context`) se concatenaba dentro del mensaje de rol `system` (`effective_sys = f"{base_sys}\n\n{tree_context}"`), alterando el contenido y cambiando el hash SHA-256 en cada turno.
	- En `prompt_cache.py`, `warmup_defaults` tokenizaba texto plano sin considerar los delimitadores de plantilla de chat del modelo (`<bos><|turn>system\n...<turn|>\n`), impidiendo que `llama.cpp` reconociera el prefijo en `create_chat_completion` y forzando la re-evaluación desde el token 0.
- **Solución**:
	- En `interface/backend/routes/call_ws.py` y `interface/backend/routes/chat.py`: se independizó el mensaje de rol `system` para mantenerlo estrictamente limpio e inmutable con `base_sys`, trasladando la inyección de `tree_context` al mensaje del usuario.
	- En `backend/prompt_cache.py`: se implementó `get_chat_formatted_system_prompt` para pre-evaluar cada prompt de agente con sus directrices de herramientas en el formato exacto de chat del modelo, indexado en RAM y disco por hash SHA-256.
	- En `backend/engine.py`: `apply_cache_if_available` restaura directamente el estado KV cache con `load_state`, permitiendo a `llama.cpp` detectar coincidencia completa de prefijo (*prefix-match hit*) y omitir la evaluación del system prompt, iniciando la generación de respuesta en menos de 1 segundo.
	- Verificado con test unitario en `LLM_Test/gemini/tests/test_clean_prompt_cache_reuse.py`.

### 📝 Registro: [v0.9.27] - Carga selectiva a memoria RAM exclusivamente de los prompts configurados
- **date-time**: 2026-10-24 09:10:00
- **Problema**:
	- `PromptCacheManager` cargaba indiscriminadamente a memoria RAM todos los archivos binarios (`*.bin`) encontrados en el directorio de caché, consumiendo memoria con estados obsoletos o huérfanos de prompts no configurados en el sistema.
- **Causa**:
	- El método `load_all_to_ram()` iteraba mediante `glob.glob("*.bin")` sobre todo archivo persistido en disco sin filtrar contra el conjunto de agentes y prompts configurados en `DEFAULT_AGENT_PROMPTS`.
- **Solución**:
	- En [`backend/prompt_cache.py`](file:///c:/work/person/hassan/Repos/ollama-proxy/backend/prompt_cache.py): implementado `load_configured_to_ram()` recibiendo `configured_prompts` en el constructor, iterando estrictamente sobre los agentes activos y cargando en RAM exclusivamente los binarios cuyo hash coincide exactamente con la configuración actual. Todo binario huérfano o stale queda descartado sin residir en memoria RAM.
	- Validados tests unitarios en `LLM_Test/gemini/engine/test_prompt_cache.py` y `LLM_Test/gemini/tests/test_clean_prompt_cache_reuse.py`.

### 📝 Registro: [v0.9.28] - Telemetría Actual de Turno y Tiempo Total de Respuesta en Chat
- **date-time**: 2026-10-24 09:23:00
- **Problema**:
	- En la interfaz web de chat (`ChatView.jsx`), el tiempo de carga del modelo mostraba 14.5s (el tiempo global de arranque en frío del proceso proxy) en lugar del tiempo actual de cada turno, y las métricas no mostraban de forma explícita el tiempo de respuesta total transcurrido en el turno actual.
- **Causa**:
	- La respuesta de `/v1/models` devolvía estáticamente la duración del arranque inicial (`load_duration`). Asimismo, la interfaz no vinculaba el tiempo de respuesta total del turno a una tarjeta específica en el desglose de métricas ni garantizaba que `done_msg` y el endpoint REST enriquecieran de forma unificada todos los campos de telemetría de turno.
- **Solución**:
	- `interface/frontend/src/components/ChatView.jsx`: Se actualizó la etiqueta de carga del modelo en RAM a `Tiempo de carga en RAM: 0.00s (RAM)`. Se expandió la sección de Generación de Respuesta a 4 columnas incluyendo la tarjeta destacada de `Tiempo Respuesta` (`total_turn_seconds` actual de este turno). Se agregó la actualización reactiva en `metrics_done` para fijar el tiempo de turno.
	- `interface/backend/routes/call_ws.py`: El mensaje de finalización `done` emite directamente los objetos completos `model_metrics`, `kv_metrics`, `prompt_metrics` y `generation_metrics` con valores estrictamente actuales del turno.
	- `interface/backend/routes/chat.py`: Se incorporó `t_turn_start = time.time()` y se inyectaron todas las métricas actuales del turno (`total_turn_seconds`, `model_metrics`, `kv_metrics`, `prompt_metrics`, `generation_metrics`) en la respuesta REST.
	- `backend/routes.py` y `interface/backend/services/llm_client.py`: Asegurado que los modelos en RAM reporten `load_time_seconds: 0.0` para turnos activos en memoria.

### 📝 Registro: [v0.9.29] - Indicador de acción en tiempo real bajo 'Thinking...' (máximo 3 palabras)
- **date-time**: 2026-10-24 09:29:30
- **Problema**:
	- Cuando el usuario enviaba un mensaje, la interfaz mostraba únicamente "Thinking..." estático sin informar qué operación estaba ejecutando internamente el modelo en cada instante.
- **Causa**:
	- El bloque indicador de carga en `ChatView.jsx` no mostraba subtítulo de estado ni suscribía los eventos dinámicos de etapa del turno antes de recibir el primer token.
- **Solución**:
	- `interface/frontend/src/components/ChatView.jsx`: Se añadió el estado reactivo `modelStatus` con la función normalizadora `formatThreeWords` que restringe el texto a un máximo estricto de 3 palabras.
	- Se integró visualmente en primera fila justo debajo de "Thinking..." mediante un badge con punto pulsante (`bg-sky-400 animate-pulse`) que informa en vivo la acción del modelo (`"Cargando modelo"`, `"Restaurando memoria"`, `"Evaluando prompt"`, `"Buscando en web"`, `"Leyendo página web"`, `"Ejecutando herramienta"`, `"Consultando subagente"`, `"Razonando respuesta"`, `"Generando respuesta"`).
	- `interface/backend/routes/call_ws.py`: Se incorporó la emisión inmediata de eventos `{"type": "status", "status": ...}` a través del socket de chat en cada transición de etapa (carga de modelo, restauración KV, evaluación de prompt y ejecución de herramientas).

### 📝 Registro: [v0.9.30] - Corrección de UnboundLocalError 'time' en WebSocket Chat
- **date-time**: 2026-10-24 09:37:30
- **Problema**:
	- En tiempo de ejecución en la Raspberry Pi 5 / contenedor Docker `interface`, el endpoint `/ws/chat` fallaba inmediatamente al recibir una petición con la excepción:
	  `UnboundLocalError: cannot access local variable 'time' where it is not associated with a value` en `line 523, in stream_tokens: t_turn_start = time.time()`.
- **Causa**:
	- El módulo `time` no estaba importado a nivel superior del archivo en `call_ws.py`. Al existir una sentencia `import time` dentro del cuerpo de la función en la llamada a herramientas (antigua línea 651), el compilador de Python consideraba a `time` como variable local para toda la función `stream_tokens`, disparando `UnboundLocalError` al evaluar `time.time()` en la cabecera antes de llegar a dicha línea.
- **Solución**:
	- `interface/backend/routes/call_ws.py`: Se importó `import time` en la cabecera del módulo y se eliminó la importación local redundante dentro del bucle de herramientas.
	- `interface/backend/routes/chat.py` y `interface/backend/services/sub_agents.py`: Se aseguró `import time` a nivel global en todos los módulos de endpoints y servicios relacionados.
	- Validada la sintaxis con `py_compile` y tests de verificación ejecutados con éxito.

### 📝 Registro: [v0.9.31] - Accion especifica con cronometro en vivo debajo de Thinking y eliminacion de doble evaluacion de prompt
- **date-time**: 2026-10-24 09:52:00
- **Problema**:
	- El estado mostrado debajo del indicador "Thinking..." usaba textos genéricos o desactualizados ("Restaurando memoria", "Procesando consulta") sin permitir saber qué etapa estaba en ejecución ni cuánto tiempo exacto tomaba cada fase. Además, el tiempo de respuesta aumentó de ~3 segundos a ~30 segundos por turno en Raspberry Pi 5.
- **Causa**:
	- En `backend/prompt_cache.py`, el método `apply_cache_if_available` ejecutaba `llm.eval(tokens)` sincrónicamente cuando el cache no estaba listo en RAM (~15s en CPU ARM64), tras lo cual `llm.create_chat_completion(...)` detectaba un desfase de prefijo al incluir tools/jinja templates y forzaba un segundo `eval` completo (~15s adicionales), duplicando la evaluación a 30s. Por su parte, la interfaz no enviaba transiciones claras ni disponía de un cronómetro en tiempo real por etapa.
- **Solución**:
	- En `backend/prompt_cache.py`: Modificado `apply_cache_if_available` para restaurar directamente `llm.load_state(cached_state)` si existe en RAM, y omitir llamadas síncronas a `llm.eval(tokens)` en tiempo de inferencia, dejando que `create_chat_completion` evalúe el prompt una única vez y eliminando de raíz la duplicación de latencia.
	- En `interface/backend/routes/call_ws.py`: Ajustados los mensajes de estado en tiempo real vía WebSocket a `"Cargando modelo"`, `"Montando cache"`, `"Evaluando prompt"`, `"Razonando respuesta"`, `"Ejecutando herramienta"` y `"Generando respuesta"`.
	- En `interface/frontend/src/components/ChatView.jsx`: Incorporado un cronómetro en tiempo real `(Xs)` al lado del estado del modelo debajo de "Thinking...", el cual se reinicia en cada cambio de fase, permitiendo al usuario visualizar con total precisión qué fase está activa y cuántos segundos consume.

### 📝 Registro: [v0.9.32] - Diagnóstico y corrección de discrepancia de hash por ausencia de PyYAML y soporte de modo sin TTS
- **date-time**: 2026-10-24 10:17:00
- **Problema**:
	- Al ejecutar peticiones de chat, el sistema reportaba un tiempo excesivo de evaluación del prompt (~37.288s en Raspberry Pi 5 y ~34s en local), anulando la reutilización de la KV Cache.
- **Causa**:
	- 1. Discrepancia crítica de hash entre contenedores: El contenedor Docker `ollama-proxy` no tiene instalada la librería `pyyaml`. En consecuencia, al ejecutar `_parse_and_get_effective_prompt`, la importación de `yaml` fallaba silenciosamente y devolvía únicamente el texto plano del prompt (451 bytes, hash `d8c466cdeaf3db79`), mientras que el contenedor `interface` (que sí dispone de `pyyaml`) construía el prompt con las herramientas completas (2195 bytes, hash `74f9fdc3722ec599`). Al llegar las solicitudes, `ollama-proxy` reportaba `applied cache: False` por disparidad de hash y forzaba la re-evaluación completa de los más de 2500 tokens en CPU en cada turno.
	- 2. Latencia añadida por invocación síncrona a Piper TTS en turnos de chat cuando el usuario no requiere síntesis por voz.
- **Solución**:
	- `backend/prompt_cache.py`: Se implementó la función nativa `_parse_yaml_fallback` sin dependencias externas para parsear el frontmatter y las herramientas de forma idéntica con o sin `pyyaml`. Ahora `ollama-proxy` genera exactamente el mismo hash (`74f9fdc3722ec599`), logrando `applied cache: True` de inmediato.
	- `interface/backend/routes/call_ws.py`: Se añadió soporte para omitir completamente el chunking de frases y llamadas al sintetizador cuando `tts_mode in ("none", "disabled", "off")`.
	- `interface/frontend/src/components/ChatView.jsx`: Se añadió el estado `ttsEnabled` (por defecto `false` para modo rápido sin voz) y un botón de alternancia rápida (Voz activa / Sin voz) en la barra superior. Con la caché de prompt activa y sin TTS, las peticiones directas pasan a responder en ~2 segundos.

### 📝 Registro: [v0.9.33] - Longest Common Prefix Token Cache con Tools y Cachés Temporales In-Place
- **date-time**: 2026-10-24 11:06:50
- **Problema**:
	- En Raspberry Pi 5 la evaluación de prompt tardaba ~35-37 segundos en cada turno porque el LLM no encontraba el caché binario de system prompt al incluir herramientas (tools), provocando que llama_cpp descartara el KV cache y reevaluara todos los tokens desde cero por CPU.
- **Causa**:
	- La plantilla Jinja del modelo inyecta la definición JSON de las herramientas dentro del bloque system, por lo que el texto y los tokens reales que ve el LLM difieren completamente de un system prompt crudo en markdown. Al enviar tools, la discrepancia de tokens obligaba a descartar el KV cache. Además, no existía mecanismo dinámico para reutilizar el contexto acumulado de turnos anteriores en diálogos multi-turno.
- **Solución**:
	- `backend/prompt_cache.py`: Reescrito para tokenizar con el formateador de chat del LLM (`chat_formatter`) incluyendo las tools de cada agente.
	- Implementado algoritmo de búsqueda por prefijo de tokens idénticos más largo (`longest common prefix match`): busca el caché cuyos tokens coincidan al 100% como prefijo del prompt recibido y selecciona el más largo, ahorrando cientos o miles de tokens en la inferencia.
	- Añadido sistema de cachés temporales de turnos con límites configurables en `.env` y `backend/config.py`: `MAX_PROMPT_CACHES` (límite LRU) y `PROMPT_CACHE_TTL` (tiempo máximo de vida).
	- Implementado reemplazo in-place del caché temporal utilizado cuando todos sus tokens coinciden con el prefijo enviado, permitiendo que las conversaciones evolucionen a ~2.0s por turno sin duplicar memoria.
	- `backend/engine.py`: Integrada la búsqueda de prefijo en `create_stream` y el generador `_wrap_stream_with_cache_update` para guardar/reemplazar el estado del KV cache justo al emitir el primer token.
	- Verificado con test multi-turno: Turn 1 (2.07s), Turn 2 (2.02s) y Turn 3 (2.04s).

### 📝 Registro: [v0.9.34] - Tolerancia de Delimitadores de Turno en Match de Prefijo KV Cache
- **date-time**: 2026-10-24 12:12:55
- **Problema**:
	- En el primer turno de inferencia con herramientas, el prefijo del prompt de la petición coincidía en 946 de los 948 tokens del system prompt precalentado (`[Prefix Debug] Candidate 'main_agent': cached_len=948, req_len=987, matched=946/948`). Al exigir igualdad estricta de tokens (`matched == c_len`), fallaba por una discrepancia de 2 tokens en los delimitadores de rol finales (`<start_of_turn>model`), provocando reevaluación completa de 25 segundos.
- **Causa**:
	- Las plantillas de chat inyectan delimitadores de rol al final del bloque del sistema que varían ligeramente cuando el sistema va seguido de un turno de usuario (`<start_of_turn>user`) versus cuando está aislado.
- **Solución**:
	- `backend/prompt_cache.py`: Actualizada la condición de `find_best_matching_cache` para aceptar coincidencias donde `prefix_match >= c_len - 4` en cachés de más de 16 tokens (`is_match = (prefix_match == c_len) or (c_len > 16 and prefix_match >= c_len - 4)`).
	- Verificado: El LLM reutiliza los 946 tokens del KV cache (`[Engine Cache] Request tokens: 987, Applied cache: True, Matched prefix: 948 tokens`), activando el caché tanto en el primer turno como en los turnos sucesivos con herramientas.

### 📝 Registro: [v0.9.35] - Corrección de coincidencia estricta de prefijos y captura de caché temporal post-stream
- **date-time**: 2026-10-24 13:38:00
- **Problema**:
	- Al enviar 4 mensajes en el chat, la carga del caché fallaba o provocaba reevaluaciones completas de ~1000 tokens en CPU tardando ~20s en cada turno.
- **Causa**:
	1. `tokenize_system_prompt_prefix` dejaba el token del centinela de usuario en el binario (`960` tokens en vez de `946`), haciendo que el prefijo del system prompt discrepase del mensaje real del usuario.
	2. `find_best_matching_cache` permitía coincidencias inexactas (`prefix_match >= c_len - 4`). En modelos Gemma con Sliding Window Attention (SWA), `llama_cpp` falla al podar el KV cache (`kv_cache_seq_rm`) y ejecuta `self.reset()`, reevaluando todo desde cero.
	3. `_wrap_stream_with_cache_update` capturaba el estado temporal en el primer chunk antes de que el asistente generara la respuesta completa, impidiendo que el Turno 2 reutilizara el Turno 1.
- **Solución**:
	- En `backend/prompt_cache.py`:
		- Se extrae con `rfind` el bloque previo a `<start_of_turn>` usando el centinela, garantizando exactamente 946 tokens limpios sin delimitadores sobrantes.
		- Se exige coincidencia estricta al 100% (`is_match = (prefix_match == c_len)`).
		- En `load_configured_to_ram`, se invalidan binarios obsoletos con tokens residuales.
	- En `backend/engine.py`:
		- Se acumula el texto del asistente a lo largo del stream y se guarda el estado completo con `save_or_replace_temporal_cache` al finalizar el stream (`finally`), permitiendo coincidencia de 100% de tokens en los turnos sucesivos.

### 📝 Registro: [v0.9.36] - Tolerancia a fallos de conexión TTS en streaming de chat
- **date-time**: 2026-10-24 16:12:00
- **Problema**:
	- Al enviar un mensaje en el chat aparecía el error `All connection attempts failed` (o `all conversation attempt failed`) interrumpiendo la conversación.
- **Causa**:
	- En `interface/backend/services/tts_client.py`, la llamada fallback `GET /api/tts` se encontraba fuera del bloque `try/except`. Cuando el servicio de audio (`piper-tts`) no estaba disponible o estaba detenido, `httpx` lanzaba `ConnectError: All connection attempts failed`.
	- En `interface/backend/routes/call_ws.py`, las llamadas a `tts_service.synthesize` en `chunker.push_token` y `chunker.flush` no capturaban este fallo, propagando la excepción hasta la raíz del WebSocket del chat y abortando la emisión de texto al cliente.
- **Solución**:
	- En `interface/backend/services/tts_client.py`: Envolver la síntesis completa en un bloque `try/except` seguro con timeout acotado (5.0s), devolviendo `b""` en caso de indisponibilidad del servicio TTS.
	- En `interface/backend/routes/call_ws.py`: Proteger las llamadas a síntesis en streaming y flush con `try/except`, permitiendo que el flujo de texto continúe sin interrupciones aunque el sintetizador de audio no esté activo.
	- Contenedor `interface` reiniciado y validado mediante `test_tts_resilience.py`.