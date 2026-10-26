# Project Status - Ollama Priority Proxy v0.9.48

## Arquitectura: Strict Preemptive Token Scheduler (Dual-Context Shared Weights) + Native OpenAI Tool-Calling Engine + Model Adapter Architecture + Dual Target Build System (linux / RPi5) + Local Docker Hub Distribution Engine (registry:2 on LAN) + Interface Voice/Chat Module (PWA) + Standalone TTS/STT Services + Standalone Web-Tools + Redis Stack Vector RAG + Dual-WebSocket Chat & Real-Time Metrics Pipeline + Real-Time Model Action Status Indicator (Max 3 Words) + Current Turn Metrics & Response Latency Tracking + Model Adapter-Driven Stop Tokens & EOS Detection Engine (`backend/adapters/`) + Hierarchical Radix Tree Prompt KV Cache Engine (Layered TreeNodes with Node Splitting, Strict Adapter EOS Truncation & Bottom-Up Leaf Pruning) + Exact Token Longest-Common-Prefix KV Prompt Cache Engine + LLM-Formatted Tools Prefixes + Dynamic Temporal Context Caching with TTL & In-Place Replacement + Configured Prompts Selective Cache Loader + Nested Sub-Agent Context Snapshot Stack + Hierarchical TreeNode RAG Memory & Branching + Zero-Cost Silence Killer + Clean-Cache Plan-and-Solve Engine + Categorized Markdown Conversation Audit Logger + Interactive Web History & Reasoning Accordion Viewer + Persistent Single-Folder Chat Session Indexer
Proxy HTTP y planificador de tokens por turno estricto con contextos KV independientes (alta/baja prioridad), pesos compartidos en memoria de solo lectura, arquitectura de adaptadores de modelo desacoplados (`backend/adapters/` e `interface/backend/services/adapters`) para dialectos de LLM (Gemma 4, Qwen, OpenAI estándar) con gestión rigurosa de delimitadores y tokens EOS para evitar falsos positivos al podar o cachear respuestas, sistema de compilación dual con diferenciación estricta de tags (`:linux` para arquitectura local nativa AMD64 sin emulación QEMU y `:RPi5` para ARM64 destinado a Raspberry Pi 5 vía `IMAGE_TAG`), motor de distribución mediante Docker Hub local privado (`registry:2` en puerto 5050) para descargas masivas concurrentes en LAN hacia Raspberry Pi 5 sin saturación de sockets SSH, motor de tool-calling nativo compatible con la API de OpenAI preservando estrictamente todas las características de request (`priority`, `fast`, `max_tokens`, `temperature`, `tools`) y response (`priority`, `times_paused`, `kv_cache_ram_mb`, métricas TPS de prompt y generación), arquitectura de doble WebSocket en interfaz de chat (`/ws/chat` para streaming ultra-rápido de tokens y audio TTS + `/ws/chat/metrics` no-streaming para telemetría granular de etapas: carga de modelo residente en RAM con 0.00s actuales por turno, evaluación de prompt, sub-agentes independientes, restauración de sesión/KV cache en RAM, indicador en vivo de acción del modelo con un máximo estricto de 3 palabras debajo de "Thinking...", duración total de respuesta por turno actual y desglose de tokens/duración por tool-calling), motor de caché jerárquico Radix Tree en memoria RAM con nodos estratificados (`CacheTreeNode`) en `backend/prompt_cache.py`: Capa 1 inmune para System Prompts con flag permanente (`is_system=True`), capas subsiguientes segmentadas por deltas de tokens, filtrado y truncado estricto de tokens EOS gobernados por el adaptador del modelo activo y descarte total de tokens posteriores antes del guardado de caché y snapshot de KV, partición dinámica de nodos (*node splitting*) al divergir secuencias y poda ascendente estricta exclusiva de hojas (*bottom-up leaf pruning*) respetando TTL y dependencias de ramas activas, sistema de cache binario en disco y precarga en memoria RAM de estados KV en formato exacto de tokens que ve el LLM incluyendo tools, motor de búsqueda y reutilización por prefijo de tokens idénticos más largo (longest common prefix match) omitiendo la reevaluación del contexto previo, gestión de cachés temporales de turnos con TTL (`PROMPT_CACHE_TTL`) y límite configurable (`MAX_PROMPT_CACHES`), reemplazo in-place de cachés temporales al evolucionar el diálogo si coinciden todos los tokens del caché con el prefijo enviado, pila de congelación y restauración inmediata de contexto en RAM (`save_context_snapshot` / `restore_context_snapshot`) que preserva el estado del agente principal al delegar en sub-agentes para continuar sin re-cálculos de tokens, módulo desacoplado de interfaz web PWA instalable en Android/navegador (React + Vite + Tailwind + Service Worker + Manifest), motor de memoria jerárquica RAG en árbol de 3 niveles (`services/tree_context_manager.py`) con ramas de conversación (`branches`), ventana estricta de 10 mensajes (5 turnos de usuario/asistente) y desruidado periódico cada 5 turnos, orquestador de planificación condicional multi-paso (`services/plan_and_solve.py`) con aislamiento de contexto limpio por tarea y síntesis exhaustiva, sistema mata-silencio de coste cero sin doble inferencia (`services/silence_killer.py`), motor de auditoría y persistencia de logs en Markdown categorizados (`services/conversation_logger.py` y `routes/logs.py`) para inspección web completa de memoria, prompts, herramientas y respuestas por turno, visor interactivo web de historial con panel lateral izquierdo deslizante de conversaciones y acordeón por turno de usuario (`components/HistoryModal.jsx`), backend orquestador de voz/llamadas (FastAPI + WebSockets + STT + TTS), microservicios independientes para Piper TTS, Vosk STT y Web-Tools (Parallel/DDG search, trafilatura reader y PDF extractor), persistencia y búsqueda vectorial RAG en Redis Stack (`/docker/storage/redis`), y suite centralizada de utilidades en `cmd/` (`setup-hub.bat`, `build-rpi5.bat`, `build-linux.bat`, `load-rpi5.sh`, `build-on-rpi5.sh`, `run.bat`).

## Mapeo de Modulos y Responsabilidades
### `backend/adapters/`
- `BaseModelAdapter`: Clase base abstracta que define la interfaz de adaptadores de modelo, incluyendo `eos_tokens` y el método `get_eos_token_ids(llm)` para extraer los tokens de parada específicos del modelo sin falsos positivos.
- `Gemma4Adapter`: Adaptador específico para familias Gemma con delimitadores `<end_of_turn>` y `<eos>`.
- `QwenAdapter`: Adaptador específico para dialectos Qwen con delimitadores `<|im_end|>` y `<|endoftext|>`.
- `StandardOpenAIAdapter`: Adaptador estándar para arquitecturas LLaMA/OpenAI con `<|eot_id|>`, `<|end_of_text|>` y `</s>`.
- `registry.py`: Registro y función `get_adapter(model_name)` para resolver el adaptador activo a partir del nombre o ruta del modelo.

### `backend/prompt_cache.py`
- `PromptCacheManager`: Gestiona el almacenamiento binario persistente (`.bin`), la tokenización exacta de mensajes con `tools`, el motor de caché en árbol Radix (`CacheTreeNode`) con filtrado estricto de tokens EOS guiado por el adaptador del modelo activo (`backend/adapters/`), división de nodos (*node splitting*) ante coincidencias parciales, poda recursiva en post-orden de hojas expiradas (*leaf-first pruning*) preservando ramas con hijos activos y protección absoluta de System Prompts (`is_system=True`), y snapshots de contexto en RAM para delegaciones.

### `backend/engine.py`
- `LlamaEngine`: Gestiona dos contextos Llama (alta y baja prioridad) compartiendo pesos en solo lectura mediante mmap, integrando `PromptCacheManager` para restaurar directamente estados KV en memoria y preservar el contexto del llamador al invocar sub-agentes.

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

### `prompts/`
- `system_prompt.md`: Prompt conversacional puro del asistente principal sin marcas de tiempo ni encabezados en texto.
- `researcher.md`: Directivas del sub-agente investigador para análisis técnico, científico y síntesis factual rigurosa.
- `coder.md`: Directivas del sub-agente programador para generación de código seguro, limpio y buenas prácticas SOLID/SRP.
- `writer.md`: Directivas del sub-agente redactor para comunicados formales, correos y síntesis ejecutiva.

### `interface/backend`
- `main.py`: Inicializa la aplicacion FastAPI del modulo interface, monta rutas REST/WebSocket y sirve los estaticos compilados de `frontend/dist`.
- `config.py`: Centraliza variables de entorno y provee funciones (`load_prompt`, `load_default_system_prompt`) para cargar dinámicamente los prompts desde `prompts/`.
- `routes/chat.py`: Endpoints REST para interaccion chat con bucle agéntico desacoplado mediante `services.adapters`.
- `routes/call_ws.py`: Handlers WebSocket para llamadas de voz (/ws/call) y chat (/ws/chat) delegando el parseo y formateo de turnos a `services.adapters`, con streaming seguro hacia TTS y emisión de debug.
- `routes/web_tools.py`: Endpoints REST `/api/tools/search`, `/api/tools/read` y `/api/tools/pdf`.
- `routes/logs.py`: Endpoints REST `/api/logs/conversations` para exploracion web de sesiones, archivos markdown e inspeccion de turnos/tools.

### `interface/backend/tools`
- `web.py`: Implementaciones y esquemas exportados de herramientas de búsqueda y lectura web (`search_web`, `read_url`, `read_pdf`).
- `delegation.py`: Implementaciones y esquemas exportados de delegación hacia sub-agentes especializados.
- `__init__.py`: Registro unificado `TOOL_REGISTRY`, filtrado de herramientas por perfil de agente y despachador `execute_tool`.
- `services/agent_manager.py`: Parsea YAML Frontmatter de archivos en `prompts/`, gestiona perfiles de agentes (`AgentProfile`), inyecta directivas y reglas de herramientas y evalúa guardrails y límites de llamadas por turno.
- `services/sub_agents.py`: Sistema desacoplado de sub-agentes especializados (Investigador, Programador, Redactor) con soporte de bucle autónomo de ejecución de herramientas autorizadas según su frontmatter.
- `services/tool_definitions.py`: Esquemas maestros de herramientas OpenAI con filtrado y contextualización dinámica según el perfil de agente activo.
- `services/tool_executor.py`: Despachador basado en registro `TOOL_REGISTRY` con validación estricta de autorización de herramientas y aplicación de límites de llamadas (*guardrails anti-abuso*).
- `services/silence_killer.py`: Formateador de estados inmediatos (< 10 palabras) a partir de los argumentos de herramientas sin inferencia adicional para matar el silencio en tiempo real.
- `services/tree_context_manager.py`: Motor de memoria RAG jerárquica en árbol de 3 niveles (`TreeNode`), gestión de ramas (`branches`), ventana fija de 10 mensajes y desruidado periódico cada 5 turnos.
- `services/plan_and_solve.py`: Orquestador de solicitudes complejas multi-paso con aislamiento de contexto limpio por tarea y síntesis final exhaustiva.
- `services/conversation_logger.py`: Motor de auditoría y persistencia de turnos de usuario, tools, subagentes y planes en archivos markdown estructurados e indexados (`{index}-{tipo}.md`) con categorización en frontmatter YAML.
- `services/web_tools_client.py`: Cliente asincrono hacia `web-tools` con autenticación Parallel exclusiva en búsqueda y desacoplada de lectura/PDF.
- `services/rag_service.py`: Servicio RAG con búsqueda vectorial RediSearch (`FT.CREATE`, `FT.SEARCH` con KNN y cosine distance) y metadatos (`TAG`, `TEXT`, `NUMERIC`) sobre Redis Stack (`/docker/storage/redis`), con fallback local.
- `services/llm_client.py`: Cliente asincrono HTTP/streaming hacia el proxy LLM con soporte de parametro nativo `tools`.

### `interface/frontend`
- `src/App.jsx`: Componente raiz con hash-routing para alternar entre modo Chat y modo Llamada y persistencia de settings de voz.
- `src/components/SettingsModal.jsx`: Modal de configuracion para alternar TTS (Navegador/RPi5), STT (Navegador/RPi5) e interrupcion por voz (Barge-in on/off).
- `src/components/MemoryModal.jsx`: Modal interactivo de telemetria de RAM en tiempo real (modelo base, KV caches activos, prompt caches y temporal snapshots).
- `src/components/HistoryModal.jsx`: Modal interactivo de auditoría con slider lateral izquierdo de conversaciones y acordeón por turno de usuario que desglosa memoria RAG, system prompt, pasos de tools/agentes y respuesta final.
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

### `interface/backend/services/conversation_logger.py`
- `ConversationLogger`: Gestiona el registro auditado de conversaciones en disco dentro de una única carpeta por sesión (`{yyyy-mm-dd--hh-mm}-{slug}`) con indexación secuencial no colisionante (`{index:03d}-{categoria}.md`), ContextVar para propagación de sesión activa y persistencia de mapeo en disco (`.sessions_map.json` / `.session_meta.json`).

### `interface/frontend/src/components/ChatView.jsx`
- `ChatView`: Vista de chat interactivo con persistencia de `chatSessionId` en `sessionStorage`, envío de `session_id` en WebSocket `/ws/chat` y API REST `/api/chat`, y botón de reinicio para nuevo chat limpio.

### `cmd/`
- `setup-hub.bat`: Inicializa y arranca el microservicio Docker Registry (`registry:2` en puerto 5050) como Hub local en Windows.
- `build-rpi5.bat`: Compila los contenedores para `linux/arm64` con tag `:RPi5` y los publica automáticamente en el Hub local.
- `build-linux.bat`: Compila los contenedores para arquitectura nativa local `linux/amd64` con tag `:linux`.
- `build-on-rpi5.sh`: Script bash nativo para compilar todos los contenedores directamente en la Raspberry Pi 5 con tag `:RPi5`.
- `load-rpi5.sh`: Script ejecutable en Raspberry Pi 5 que descarga del Hub local por LAN y re-etiqueta todas las imágenes con limpieza de alias.
- `run.bat`: Acceso directo para ejecutar el backend en entorno de desarrollo local mediante `uv`.

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
	- **Payload Bidireccional**: JSON `{ messages: list, model: str (opcional), turn_id: str (opcional) }` -> Tokens `{ type: "token", token: str }`, chunks de audio `{ type: "audio_chunk", audio_base64: str }` y `{ type: "stream_done", full_text: str }`.
	- **Descripcion**: Canal WebSocket 1 (Streaming ultra-rápido): emisión exclusiva de tokens y síntesis de voz en tiempo real sin sobrecarga de datos.
- `[WS] /ws/chat/metrics` [Auth: None / Public]:
	- **Payload Bidireccional**: Conexión con `?turn_id={id}` o JSON `{ type: "subscribe", turn_id: str }` -> Eventos JSON estructurados de etapas: `{ type: "metric", stage: "model_load" | "prompt_execution" | "kv_cache" | "tool_execution" | "sub_agent" | "generation_metrics" }` y `{ type: "metrics_done", summary: dict }`.
	- **Descripcion**: Canal WebSocket 2 (No-streaming / Métricas): entrega de telemetría por etapas (carga de modelo, evaluación de prompt, sub-agentes independientes, restauración de sesión/KV en RAM, tiempos y desglose de tokens por tool-calling).
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
- `[GET] /v1/system/memory` y `[GET] /api/system/memory` [Auth: Bearer / Public]:
	- **Response**: `{ process: { rss_mb, vms_mb }, model: { filename, file_size_mb, flash_attn }, active_contexts: {...}, prompt_cache: {...}, summary: {...} }`
	- **Descripcion**: Telemetria desglosada de RAM del proxy LLM (pesos modelo, contextos KV activos, prompt caches y temporal snapshots).
- `[GET] /api/proxy/memory` [Auth: None / Public]:
	- **Response**: Mismo payload que `/v1/system/memory` reenviado desde el backend de la interfaz web hacia el frontend.
- `[GET] /api/logs/conversations` [Auth: None / Public]:
	- **Response**: `{ conversations: [{ session_dir: str, files_count: int, path: str }] }`
	- **Descripcion**: Lista las carpetas de conversaciones históricas ordenadas cronológicamente de forma descendente.
- `[GET] /api/logs/conversations/{session_dir}` [Auth: None / Public]:
	- **Params**: `category` (opcional: user_turn | tool_call | agent_execution | plan_step)
	- **Response**: `{ session_dir: str, files: [{ filename: str, category: str, size_bytes: int, modified: float }], total: int }`
	- **Descripcion**: Lista los archivos Markdown de una conversación permitiendo filtrado por categoría.
- `[GET] /api/logs/conversations/{session_dir}/{filename}` [Auth: None / Public]:
	- **Response**: `{ session_dir: str, filename: str, content: str }`
	- **Descripcion**: Devuelve el contenido completo en Markdown del archivo solicitado para inspección web.
- `[GET] /api/logs/conversations/{session_dir}/tree` [Auth: None / Public]:
	- **Response**: `{ session_dir: str, tree: { name: str, data: str | null, updated_at: float, children: dict } }`
	- **Descripcion**: Devuelve la estructura jerárquica de nodos TreeNode con todos sus parámetros para visualización interactiva colapsable con scroll horizontal en el visor web.
- `[GET] /system/cache/tree` y `[GET] /api/system/cache/tree` [Auth: None / Public]:
	- **Response**: `{ name: str, cache_id: str, is_system: bool, token_count: int, tokens_sample: list, hit_count: int, ema_score: float, children: dict }`
	- **Descripcion**: Serialización completa del árbol Radix de KV Cache en RAM desde el proxy LLM.
- `[GET] /api/logs/memory/current` y `[GET] /api/logs/memory/tree/current` [Auth: None / Public]:
	- **Response**: `{ status: "ok", mode: "global_current", tree: { name: str, data: str, children: { kv_cache: dict, rag_memory: dict } } }`
	- **Descripcion**: Devuelve el estado global de la memoria en tiempo real unificando el Radix KV Cache de la RAM del proxy y el árbol contextual RAG activo de Redis.
