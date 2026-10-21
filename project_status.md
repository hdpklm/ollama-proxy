# Project Status - Ollama Priority Proxy v0.9.9

## Arquitectura: Strict Preemptive Token Scheduler (Dual-Context Shared Weights) + Native OpenAI Tool-Calling Engine + Model Adapter Architecture + Dual Target Build System (linux / RPi5) + Interface Voice/Chat Module (PWA) + Standalone TTS/STT Services + Standalone Web-Tools + Redis Stack Vector RAG + Real-time WebSocket Debug Stream + Binary KV Prompt Cache Engine
Proxy HTTP y planificador de tokens por turno estricto con contextos KV independientes (alta/baja prioridad), pesos compartidos en memoria de solo lectura, arquitectura de adaptadores de modelo desacoplados (`services/adapters`) para dialéctos de LLM (Gemma 4, Qwen, OpenAI estándar), sistema de compilación dual con diferenciación estricta de tags (`:linux` para arquitectura local nativa AMD64 sin emulación QEMU y `:RPi5` para ARM64 destinado a Raspberry Pi 5 vía `IMAGE_TAG`), motor de tool-calling nativo compatible con la API de OpenAI preservando estrictamente todas las características de request (`priority`, `fast`, `max_tokens`, `temperature`, `tools`) y response (`priority`, `times_paused`, `kv_cache_ram_mb`, métricas TPS de prompt y generación), sistema de cache binario en disco y precarga en memoria RAM de estados KV de system prompts para agente principal y sub-agentes con invalidación por hash SHA256 (`backend/prompt_cache.py`), módulo desacoplado de interfaz web PWA instalable en Android/navegador (React + Vite + Tailwind + Service Worker + Manifest), backend orquestador de voz/llamadas (FastAPI + WebSockets + STT + TTS) con emisión en tiempo real de eventos internos de depuración (tool-calling, thinking tokens, etapas de ejecución y resultados gobernados por `HIDE_BACKGROUND=false` en `.env`), microservicios independientes para Piper TTS, Vosk STT y Web-Tools (Parallel/DDG search, trafilatura reader y PDF extractor), persistencia y búsqueda vectorial RAG en Redis Stack (`/docker/storage/redis`), y scripts desacoplados de compilacion (`build.bat`, `build-linux.bat`, `build-rpi5.bat`) y transferencia directa SSH (`send.bat`, `build-n-send.bat`).

## Mapeo de Modulos y Responsabilidades
### `backend/prompt_cache.py`
- `PromptCacheManager`: Gestiona el almacenamiento binario persistente (`.bin`) y la precarga en memoria RAM de estados KV pre-evaluados de cabeceras/system prompts, indexados por hash SHA256 e invalidando binarios obsoletos al detectar cambios.

### `backend/engine.py`
- `LlamaEngine`: Gestiona dos contextos Llama (alta y baja prioridad) compartiendo pesos en solo lectura mediante mmap, integrando `PromptCacheManager` para restaurar directamente estados KV en memoria y omitir la evaluación de tokens de cabecera repetidos.

### `backend/scheduler.py`
- `Scheduler`: Bucle continuo de evaluacion de 1 token por tick dando prioridad estricta al 100% de la CPU a tareas urgentes, orquestando streams de texto y eventos de `tool_calls`, e incrementando `times_paused` al interrumpir tareas en curso.

### `backend/responses.py`
- `responses`: Serializador de eventos SSE y respuestas JSON compatibles con OpenAI y Ollama, incluyendo `tool_calls` sin perder `priority`, `times_paused`, `kv_cache_ram_mb` ni métricas TPS.

### `backend/job.py`
- `Job`: Estructura de datos para solicitudes de chat, completado y generacion con colas de emision asincronas y acumulacion de `tool_calls`.

### `dockers/web-tools`
- `main.py`: Microservicio FastAPI que expone en puerto 7000 busqueda web (Parallel API / DDG), extraccion de articulos a Markdown (`trafilatura`/`markdownify`) y conversion de PDF a Markdown (`pypdf`).
- `Dockerfile`: Contenedor independiente con Python 3.11, gestor `uv` y cache compartida.

### `dockers/piper`
- `main.py`: Microservicio FastAPI que expone Piper TTS en el puerto 5000 (HTTP GET/POST) descargando automaticamente modelos ONNX en espanol a cache local.
- `Dockerfile`: Contenedor independiente con Python 3.11, gestor `uv` y cache compartida.

### `dockers/vosk`
- `main.py`: Microservicio FastAPI que expone Vosk STT en el puerto 2700 (HTTP POST y WebSocket bidireccional) con el modelo `vosk-model-small-es-0.42`.
- `Dockerfile`: Contenedor independiente con Python 3.11, gestor `uv` y cache compartida.

### `interface/backend`
- `main.py`: Inicializa la aplicacion FastAPI del modulo interface, monta rutas REST/WebSocket y sirve los estaticos compilados de `frontend/dist`.
- `config.py`: Centraliza variables de entorno para endpoints externos de LLM, STT, TTS, Web-Tools y Redis, e inyeccion limpia de `system_prompt.md`.
- `system_prompt.md`: Prompt conversacional puro sin inyeccion artificial de esquemas en texto.
- `routes/chat.py`: Endpoints REST para interaccion chat con bucle agéntico desacoplado mediante `services.adapters`.
- `routes/call_ws.py`: Handlers WebSocket para llamadas de voz (/ws/call) y chat (/ws/chat) delegando el parseo y formateo de turnos a `services.adapters`, con streaming seguro hacia TTS y emisión de debug.
- `routes/web_tools.py`: Endpoints REST `/api/tools/search`, `/api/tools/read` y `/api/tools/pdf`.
- `services/adapters`: Módulo unificado de adaptadores de modelos (`BaseModelAdapter`, `Gemma4Adapter`, `QwenAdapter`, `StandardOpenAIAdapter`, `get_adapter`).
- `services/sub_agents.py`: Sistema desacoplado de sub-agentes especializados (Investigador, Programador, Redactor) invocables como herramientas nativas con prompts, modelos y temperaturas dedicadas.
- `services/tool_definitions.py`: Esquemas estándar de herramientas OpenAI (`search_web`, `read_url`, `read_pdf`, delegaciones a sub-agentes).
- `services/tool_executor.py`: Despachador limpio basado en registro `TOOL_REGISTRY` (`_search_web`, `_read_url`, `_read_pdf`, sub-agentes) con acotación de contexto para evitar desbordes de `n_ctx`.
- `services/web_tools_client.py`: Cliente asincrono hacia `web-tools` con autenticación Parallel exclusiva en búsqueda y desacoplada de lectura/PDF.
- `services/rag_service.py`: Servicio RAG con búsqueda vectorial RediSearch (`FT.CREATE`, `FT.SEARCH` con KNN y cosine distance) y metadatos (`TAG`, `TEXT`, `NUMERIC`) sobre Redis Stack (`/docker/storage/redis`), con fallback local.
- `services/llm_client.py`: Cliente asincrono HTTP/streaming hacia el proxy LLM con soporte de parametro nativo `tools`.

### `interface/frontend`
- `src/App.jsx`: Componente raiz con hash-routing para alternar entre modo Chat y modo Llamada y persistencia de settings de voz.
- `src/components/SettingsModal.jsx`: Modal de configuracion para alternar TTS (Navegador/RPi5), STT (Navegador/RPi5) e interrupcion por voz (Barge-in on/off).
- `src/components/ChatView.jsx`: Interfaz de mensajeria con dictado por voz WebSocket en tiempo real, visor interactivo de herramientas ejecutadas y telemetría de rendimiento (TPS de prompt y generación).
- `src/components/CallView.jsx`: Vista de llamada interactiva a pantalla completa con ondas de audio reactivas, subtitulos parciales en vivo y gestion de microfono.
- `src/hooks/useVoiceCall.js`: Hook para gestion de llamada WebSocket bidireccional con 3 modos de AEC seleccionables (Nativo HTMLAudioElement, Silero VAD y WebRTC AEC3 con calibracion acustica inicial).

### `backend/config.py`
- `config`: Gestiona variables de entorno, configuraciones de contexto/hilos y resolucion de rutas GGUF.

### `backend/engine.py`
- `LlamaEngine`: Gestiona dos contextos Llama (alta y baja prioridad) compartiendo pesos en solo lectura mediante mmap.

### `backend/job.py`
- `Job`: Estructura de datos para solicitudes de chat, completado y generacion con colas de emision asincronas.

### `backend/scheduler.py`
- `Scheduler`: Bucle continuo de evaluacion de 1 token por tick dando prioridad estricta al 100% de la CPU a tareas urgentes.

### `backend/responses.py`
- `responses`: Serializador de eventos SSE y respuestas JSON compatibles con OpenAI y Ollama.

### `backend/routes.py`
- `routes`: Endpoints HTTP FastAPI para `/v1/chat/completions`, `/v1/completions`, `/v1/models` y `/api/generate`.

### `backend/auth.py`
- `require_key`: Dependencia de seguridad que valida el token Bearer configurable.

### `main.py`
- `lifespan`: Gestiona el ciclo de vida de la aplicacion FastAPI, inicializando el motor Llama y el Scheduler.

## Endpoints / Interfaces Externas
- `[POST] /v1/chat/completions` [Auth: Bearer]:
	- **Params / Payload**: `{ model: str, messages: list, priority: bool (opcional), stream: bool (opcional) }`
	- **Response**: `{ id: str, choices: list, usage: dict }` o SSE Stream
	- **Descripcion**: Generacion de chat compatible con OpenAI con soporte de prioridad.
- `[POST] /v1/completions` [Auth: Bearer]:
	- **Params / Payload**: `{ model: str, prompt: str, priority: bool (opcional), stream: bool (opcional) }`
	- **Response**: `{ id: str, choices: list, usage: dict }` o SSE Stream
	- **Descripcion**: Generacion de texto completion compatible con OpenAI con soporte de prioridad.
- `[POST] /api/generate` [Auth: None / Public]:
	- **Params / Payload**: `{ prompt: str, priority: bool (opcional), max_tokens: int (opcional) }`
	- **Response**: `{ response: str, priority: bool, kv_cache_ram_mb: float, time_seconds: float, times_paused: int }`
	- **Descripcion**: Endpoint nativo documentado en Docs/llama-cpp-pythom.md.
- `[GET] /v1/models` [Auth: Bearer]:
	- **Response**: `{ data: [{ id: str, object: "model" }] }`
	- **Descripcion**: Lista los modelos cargados en el proxy.
- `[GET] /api/health` [Auth: None / Public]:
	- **Response**: `{ status: "ok", service: "voice-chat-interface" }`
	- **Descripcion**: Comprobacion de salud del backend de interfaz.
- `[POST] /api/chat` [Auth: None / Public]:
	- **Params / Payload**: `{ message: str, voice: bool (opcional) }`
	- **Response**: `{ reply: str, audio_base64: str | null }`
	- **Descripcion**: Envio de mensaje de texto en modo chat y generacion opcional de audio asistencial.
- `[POST] /api/stt` [Auth: None / Public]:
	- **Params / Payload**: `Multipart form: audio file`
	- **Response**: `{ text: str }`
	- **Descripcion**: Transcripcion de nota de voz enviada en el chat.
- `[POST] /api/tts` [Auth: None / Public]:
	- **Params / Payload**: `{ text: str, voice: str (opcional) }`
	- **Response**: Audio stream WAV/MP3 o `{ audio_base64: str }`
	- **Descripcion**: Sintesis directa de audio a peticion para el boton de reproducir.
- `[WS] /ws/call` [Auth: None / Public]:
	- **Payload Bidireccional**: Binario PCM/WAV (audio microfono) o JSON `{ type: "audio" | "transcript" | "tts_chunk" | "status" | "interrupt" }`
	- **Descripcion**: Canal interactivo bidireccional de baja latencia para llamadas de voz con VAD (700ms), streaming LLM y sintesis de frases.
- `[WS] /ws/stt` [Auth: None / Public]:
	- **Payload Bidireccional**: Binario PCM16 (audio microfono) -> JSON `{ type: "transcript", text: str, is_final: bool }`
	- **Descripcion**: Streaming continuo de audio hacia Vosk para transcripcion y dictado en vivo en el campo de entrada.
- `[WS] /ws/chat` [Auth: None / Public]:
	- **Payload Bidireccional**: JSON `{ messages: list, model: str (opcional) }` -> Tokens SSE/JSON `{ type: "token", token: str }` y `{ type: "done", full_text: str }`.
	- **Descripcion**: Generacion token a token mediante WebSocket para visualizacion progresiva en tiempo real en la interfaz de chat.
- `[POST] /api/tools/search` [Auth: None / Public]:
	- **Params / Payload**: `{ query: str, max_results: int (default: 5) }`
	- **Response**: `{ status: "ok", provider: "parallel" | "duckduckgo", results: [...] }`
	- **Descripcion**: Busqueda web con Parallel API (si hay API key) o fallback a DuckDuckGo, con cache RAG en Redis.
- `[POST] /api/tools/read` [Auth: None / Public]:
	- **Params / Payload**: `{ url: str }`
	- **Response**: `{ status: "ok", url: str, title: str, markdown: str }`
	- **Descripcion**: Extraccion y lectura de pagina web convertida a Markdown limpio con trafilatura / markdownify.
- `[POST] /api/tools/pdf` [Auth: None / Public]:
	- **Params / Payload**: `Multipart form: file` o JSON `{ url: str }`
	- **Response**: `{ status: "ok", filename: str, pages: int, markdown: str }`
	- **Descripcion**: Conversion de documentos PDF a Markdown estructurado por pagina.
