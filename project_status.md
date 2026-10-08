# Project Status - Ollama Priority Proxy v0.2.2

## Arquitectura: Arquitectura Modular por Capas (Embedded Engine & Priority Scheduler)
Proxy HTTP y servidor de inferencia local con planificador de prioridades e interrupcion cooperativa por token para ejecucion en hardware con recursos limitados.

## Mapeo de Modulos y Responsabilidades
### `backend/config.py`
- `config`: Gestiona variables de entorno, configuraciones de contexto/hilos y resolucion de rutas GGUF.

### `backend/engine.py`
- `LlamaEngine`: Encapsula la instancia unica en memoria de llama-cpp-python, calculo de KV RAM y generacion con interrupcion a nivel de token.

### `backend/job.py`
- `Job`: Estructura de datos para solicitudes de chat, completado y generacion con estado de prioridad y colas de emision.

### `backend/scheduler.py`
- `Scheduler`: Planificador de cola de prioridad que coordina pausas cooperativas por token y reanudacion inmediata.

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
