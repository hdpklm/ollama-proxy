

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