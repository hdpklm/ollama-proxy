# Project Status - Ollama Priority Proxy v0.7.17

## Arquitectura: Strict Preemptive Token Scheduler (Dual-Context Shared Weights) + Interface Voice/Chat Module (PWA) + Standalone TTS/STT Services
Proxy HTTP y planificador de tokens por turno estricto con contextos KV independientes (alta/baja prioridad), pesos compartidos en memoria de solo lectura, modulo desacoplado de interfaz web PWA instalable en Android/navegador (React + Vite + Tailwind + Service Worker + Manifest), backend orquestador de voz/llamadas (FastAPI + WebSockets + STT + TTS), microservicios independientes para Piper TTS y Vosk STT, y scripts desacoplados de compilacion local (`build.bat`) y transferencia directa SSH (`send.bat`).

## Mapeo de Modulos y Responsabilidades
### `dockers/piper`
- `main.py`: Microservicio FastAPI que expone Piper TTS en el puerto 5000 (HTTP GET/POST) descargando automaticamente modelos ONNX en espanol a cache local.
- `Dockerfile`: Contenedor independiente con Python 3.11, gestor `uv` y cache compartida.

### `dockers/vosk`
- `main.py`: Microservicio FastAPI que expone Vosk STT en el puerto 2700 (HTTP POST y WebSocket bidireccional) con el modelo `vosk-model-small-es-0.42`.
- `Dockerfile`: Contenedor independiente con Python 3.11, gestor `uv` y cache compartida.

### `interface/backend`
- `main.py`: Inicializa la aplicacion FastAPI del modulo interface, monta rutas REST/WebSocket y sirve los estaticos compilados de `frontend/dist`.
- `config.py`: Centraliza variables de entorno para endpoints externos de LLM, STT, TTS y puerto del servidor.
- `routes/chat.py`: Endpoints REST para interaccion asincrona en modo chat (envio de texto, audio con reproduccion y sintesis).
- `routes/call_ws.py`: Handler WebSocket para llamadas de voz en tiempo real con deteccion de silencio (700ms), streaming al LLM y sintesis de audio segmentada por oraciones.
- `services/llm_client.py`: Cliente asincrono HTTP/streaming hacia el proxy LLM.
- `services/stt_client.py`: Cliente de transcripcion hacia Vosk (HTTP/WebSocket).
- `services/tts_client.py`: Cliente de sintesis de voz hacia Piper.
- `services/sentence_chunker.py`: Buffer de tokens del LLM que segmenta texto por limites de oracion para alimentar concurrentemente al TTS.

### `interface/frontend`
- `src/App.jsx`: Componente raiz con hash-routing para alternar entre modo Chat y modo Llamada.
- `src/components/ChatView.jsx`: Interfaz de mensajeria con envio de texto, grabacion de notas de voz y boton de reproduccion de audio asistencial.
- `src/components/CallView.jsx`: Vista de llamada interactiva a pantalla completa con ondas de audio reactivas, estado de llamada y gestion de microfono en tiempo real.
- `src/hooks/useVoiceCall.js`: Hook para gestion de canal WebSocket, captura continua de audio de 16 kHz y cola de reproduccion de audio entrante.

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
