

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