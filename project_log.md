

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