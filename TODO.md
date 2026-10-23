# Roadmap & TODO - Ollama Priority Proxy

Lista de características, optimizaciones y tareas pendientes ordenadas por prioridad y módulos de desarrollo.

---

## 🚀 Fase 1: Mejoras Esenciales de la Experiencia de Chat (UX & Control)

### 1. Renderizado de Markdown y Bloques de Código con Botón Copiar
- [ ] **Soporte completo de Markdown en mensajes del asistente**:
	- Renderizar texto enriquecido (negritas, cursivas, encabezados, citas y listas con viñetas).
	- Renderizado de tablas Markdown formateadas con estética moderna y bordes sutiles.
- [ ] **Bloques de código con Syntax Highlighting y Acción Copiar**:
	- Cabecera con el lenguaje detectado (`python`, `bash`, `javascript`, `json`, etc.).
	- Botón con icono para copiar el código directamente al portapapeles con confirmación visual (*"Copiado"*).
	- Mayor legibilidad cuando responden sub-agentes técnicos como `coder`.

---

### 2. Botón "Detener Generación" (Stop / Abort)
- [ ] **Control de ejecución y ahorro de CPU en Raspberry Pi 5**:
	- Reemplazar el botón de envío por un botón rojo de "Detener" (`Square` / Stop) mientras el asistente genera tokens o ejecuta herramientas.
	- Emitir cancelación inmediata al WebSocket (`/ws/chat`), abortando la inferencia en `ollama-proxy` para liberar hilos y evitar turnos innecesarios.

---

### 3. Gestor de Ventana de Contexto (Context Sliding Window)
- [ ] **Poda inteligente y acotación de contexto**:
	- Implementar ventana deslizante en el backend para respetar la capacidad del contexto (`n_ctx=2048` en RPi5).
	- Preservar siempre intacto el `system_prompt` y los últimos *N* mensajes relevantes del usuario y asistente.
	- Evitar desbordes de memoria KV y mantener la latencia de evaluación de prompt siempre al mínimo sin importar la duración de la conversación.

---

### 4. Persistencia de Historial y Gestión de Sesiones
- [ ] **Persistencia local y respaldo en Redis**:
	- Guardar mensajes en `localStorage` del navegador para que no se pierdan al recargar la página (F5 o móvil).
	- Botón para "Nuevo Chat" / Limpiar conversación.
	- Persistencia opcional de sesiones y recuperación mediante el contenedor Redis Stack activo en puerto 6379.

---

### 5. Estado en Vivo de Herramientas y Sub-Agentes
- [ ] **Indicadores animados durante ejecución**:
	- Mostrar un badge animado en tiempo real cuando se invoca una herramienta (*"🔍 Buscando en la web: [consulta]..."*, *"🧠 Investigador analizando datos..."*).
	- Transición suave hacia el stream de tokens al finalizar la llamada a la herramienta.

---

## 🧠 Fase 2: Documentos, Memoria Semántica y Sub-Agentes

### 6. Subida y Análisis de Documentos en el Chat (Chat con PDFs y Código)
- [ ] **Carga de archivos mediante botón de clip o Drag & Drop**:
	- Botón de adjuntar archivo en el input para subir `.pdf`, `.txt`, `.md`, `.py`, `.js`, `.json`.
	- Integración con el microservicio `web-tools` (`/api/tools/pdf`) para extracción instantánea de texto en Markdown.
	- Capacidad de consultar, resumir o depurar documentos directamente en la conversación.

---

### 7. Memoria Semántica a Largo Plazo (Vector RAG con Redis)
- [ ] **Persistencia de hechos y preferencias con RediSearch**:
	- Extracción automática de hechos o preferencias del usuario (*"Mi nombre es...", "Uso Debian...", "Prefiero código conciso"*).
	- Almacenamiento vectorial en el contenedor `redis-stack-server` existente en el puerto 6379.
	- Retrieval semántico en cada turno para inyectar recuerdos pertinentes en el contexto sin penalizar la ventana de tokens.

---

### 8. Invocación Directa de Sub-Agentes (@mentions o Chips)
- [ ] **Atajos directos para saltar el orquestador general**:
	- Soporte para menciones en el input: `@coder`, `@researcher`, `@writer`.
	- Selector visual de píldoras sobre el campo de texto (*"Asistente"*, *"Programador"*, *"Investigador"*, *"Redactor"*).
	- Envío directo al sub-agente seleccionado usando su prompt y temperatura pre-cargados en RAM desde la carpeta `prompts/`.

---

## ⚡ Fase 3: Productividad, Audio y Control de Generación

### 9. Regeneración de Respuestas y Edición de Mensajes
- [ ] **Edición retroactiva y Reintento**:
	- Botón para editar el mensaje enviado por el usuario, truncando y regenerando el turno desde ese punto.
	- Botón de "Regenerar" en el mensaje del asistente para obtener una respuesta alternativa con nueva semilla/temperatura.

---

### 10. Selector de Modos de Generación en el Input
- [ ] **Interruptor de modos de inferencia en tiempo real**:
	- **⚡ Modo Prioritario (Turbo)**: Inyecta `priority: true` para pausar tareas secundarias y dar el 100% de CPU de la RPi5 a la respuesta actual.
	- **🎯 Modo Factual / Código**: Fija temperatura baja (0.1) y `fast: true` para máxima precisión algorítmica.
	- **💡 Modo Creativo**: Temperatura moderada (0.7) para lluvia de ideas y redacción de textos.

---

### 11. Modo "Push-to-Talk" con Barra Espaciadora en PC
- [ ] **Interacción rápida por voz en escritorio**:
	- Mantener pulsada la tecla espaciadora (o tecla de acceso rápido) para activar el micrófono por WebSocket (Vosk STT) y soltar para transcribir y enviar inmediatamente.
	- Experiencia tipo walkie-talkie sin requerir clics continuos en pantalla.

---

### 12. Exportación de Conversaciones
- [ ] **Descarga de historial de chat**:
	- Botón en la cabecera para exportar la conversación completa a un archivo `.md` formateado.
	- Compatible para importación directa en Obsidian, Notion o respaldo documental.

---

## 🖥️ Fase 4: Integración con Hardware, Sistema y Domótica (RPi5 & IoT)

### 13. Herramienta de Telemetría del Sistema (`system_stats`)
- [ ] **Monitorización física de la Raspberry Pi 5 desde el chat**:
	- Creación de herramienta nativa `get_system_stats()` accesible por el modelo.
	- Lectura en tiempo real de temperatura de CPU (`vcgencmd measure_temp`), estado de estrangulamiento térmico/voltaje (*throttled flags*), carga de CPU y memoria libre.
	- Respuestas contextualizadas a preguntas del usuario como *"¿Cómo va de temperatura la RPi5?"* o *"¿Tiene mucha carga el servidor?"*.

---

### 14. Control Domótico con Home Assistant / MQTT
- [ ] **Automatización del hogar integrada en chat y voz**:
	- Integración mediante cliente REST hacia Home Assistant o conexión con broker MQTT local.
	- Definición de herramientas para consultar estado de sensores (*"¿Qué temperatura hace en el salón?"*) y conmutar actuadores (*"Apaga la luz del despacho"*).
	- Ejecutable con confirmación de seguridad en pantalla antes de activar dispositivos críticos.

---

## 👁️ Fase 5: Visión Multimodal y Experiencia de Audio Avanzada

### 15. Soporte de Visión Multimodal (Cámara y Fotos)
- [ ] **Análisis de imágenes en cliente web y móvil**:
	- Botón de cámara en el móvil y subida de imágenes (`.png`, `.jpg`, `.webp`) en PC.
	- Integración con modelos de visión compactos optimizados para ARM64/RPi5 (ej. `minicpm-v`, `moondream2` o `qwen2-vl`).
	- Capacidad para lectura de documentos fotografiados, OCR de texto manuscrito y diagnóstico visual de componentes o diagramas.

---

### 16. Voz Diferenciada por Sub-Agente en Piper TTS
- [ ] **Personalización acústica por rol de especialista**:
	- Mapeo de voces ONNX independientes en Piper TTS:
		- Asistente Principal: voz balanceada conversacional (ej. `es_ES-sharvard-medium`).
		- Programador (`coder`): voz técnica y directa.
		- Investigador (`researcher`): voz formal y pausada.
		- Redactor (`writer`): voz elocuente y cálida.
	- Enriquecimiento de la inmersión auditiva durante llamadas de voz y reproducción de audio.

---

### 17. Palabra de Activación Manos Libres (*Wake Word*)
- [ ] **Detección continua de palabra clave local**:
	- Integración de motor ultra-ligero de detección de wake-word (`openWakeWord` o Vosk keyword spotting) en frontend/backend.
	- Activación sin pulsar la pantalla al decir *"Oye Asistente"* o *"Raspberry"*.
	- Auto-conexión fluida con el WebSocket de llamada `/ws/call`.

---

## 🎨 Fase 6: Artefactos Interactivos, Búsqueda Global y Personalidad

### 18. Previsualización de Código en Vivo (*Live Preview Sandbox*)
- [ ] **Renderizado de componentes generados (Estilo Canvas/Artifacts)**:
	- Pestaña lateral o modal interactivo al detectar código HTML, CSS, JavaScript o gráficos SVG generados por `coder`.
	- Ejecución aislada en un `iframe` seguro para probar interfaces web y utilidades visuales al momento.
	- Soporte para renderizado interactivo de diagramas `Mermaid.js`.

---

### 19. Buscador Instantáneo en el Historial con Redis (`FT.SEARCH`)
- [ ] **Búsqueda global full-text de conversaciones pasadas**:
	- Indexación de turnos de diálogo en Redis Stack mediante RediSearch.
	- Barra de búsqueda con modal de acceso rápido (Ctrl+K o icono de lupa) con resaltado de términos coincidentes.
	- Recuperación y salto inmediato a la conversación histórica seleccionada.

---

### 20. Modos de Personalidad / Perfiles Rápidos (Pills de Sistema)
- [ ] **Selector de tono y rol conversacional instantáneo**:
	- Píldoras intercambiables sobre el input:
		- **🎓 Tutor**: Explicaciones guiadas paso a paso y pedagogía.
		- **⚡ Ultra Conciso**: Comandos o datos directos sin preámbulos ni cortesías.
		- **🛡️ Auditor de Código**: Enfoque crítico en seguridad, buenas prácticas y bugs.
	- Inyección dinámica de directivas de estilo en el system prompt sin invalidar el KV-cache base.

---

## 🛡️ Fase 7: Automatización, Canales de Contingencia y Ejecución Segura

### 21. Canal de Contingencia Telegram Bot (Acceso Remoto vía Tailscale / Fallback)
- [ ] **Pasarela de respaldo si la interfaz web no está accesible**:
	- Bot de Telegram ultra-ligero en Python corriendo en la Raspberry Pi 5.
	- Conectado localmente a `ollama-proxy` y accesible remotamente desde cualquier lugar mediante la red privada de Tailscale.
	- Soporte para mensajes de texto y notas de voz (transcripción entrante con Vosk STT y respuesta de audio opcional con Piper TTS).
	- Garantiza canal de comunicación ininterrumpido con el asistente ante fallos de navegador o caídas de UI.

---

### 22. Intérprete Python Sandbox en Contenedor Docker Aislado
- [ ] **Entorno seguro de ejecución de código para evitar romper el host**:
	- Microservicio en un contenedor Docker independiente y sin privilegios (*isolated sandbox*).
	- Pre-equipado con librerías comunes de Python para múltiples propósitos:
		- Matemáticas y cálculo científico (`numpy`, `scipy`, `sympy`).
		- Tratamiento y análisis de datos (`pandas`, `csv`, `json`).
		- Manipulación de texto y scraping ligero.
	- Herramienta nativa OpenAI `execute_python_code(code: str)`: el LLM genera el script, el orquestador lo envía al contenedor seguro, ejecuta con timeout estricto y límites de memoria/CPU, y devuelve `stdout`/`stderr` estructurado al modelo.

---

### 23. Agente Autónomo Proactivo y Tareas Programadas (Cron Inteligente)
- [ ] **Automatizaciones programadas y reportes proactivos**:
	- Programador de tareas en segundo plano en la RPi5 para ejecuciones periódicas o eventos específicos.
	- Generación automática de resúmenes matutinos (noticias de interés, previsión meteorológica, estado de servidores).
	- Tareas de vigilancia periódica (monitoreo de cambios en páginas web, precios o alertas del sistema) con depósito del reporte listo en el historial de chat.

---

## 🌐 Fase 8: Navegación Profunda, Debates y Notificaciones

### 24. Modo Debate / Conferencia Multi-Agente Colaborativa
- [ ] **Discusión cruzada entre especialistas frente al usuario**:
	- Modo interactivo donde dos o más sub-agentes analizan un problema desde ángulos opuestos.
	- Ejemplo: `researcher` evalúa aspectos teóricos y benchmarks, `coder` rebate con limitaciones de arquitectura y complejidad de código, y el Asistente sintetiza la decisión recomendada.
	- Flujo de turnos visible en tiempo real en la interfaz de usuario.

---

### 25. Navegación Web Profunda con Navegador Headless (Playwright / Chromium)
- [ ] **Extracción y navegación en sitios web dinámicos con JavaScript**:
	- Extensión en `web-tools` con Chromium headless ligero para páginas que no pueden leerse mediante HTML plano.
	- Soporte para renderizado completo de Single Page Applications (SPA), interacción con botones y scroll para carga dinámica de contenido.
	- Capacidad de captura de pantalla (*screenshot full-page*) para análisis visual con modelos multimodales.

---

### 26. Notificaciones Push Web en Móvil (PWA Web Push)
- [ ] **Avisos nativos en Android y PC al concluir tareas largas**:
	- Implementación del estándar Web Push con Service Worker en la PWA.
	- Notificación al dispositivo del usuario cuando finaliza una investigación extensa en segundo plano o una tarea programada sin necesidad de mantener la pestaña abierta.

---

### 27. Generador Interactivo de Diagramas de Arquitectura (Mermaid / SVG en Vivo)
- [ ] **Visualización gráfica de diagramas técnicos**:
	- Detección automática de bloques `mermaid` en respuestas del asistente o sub-agente `coder`.
	- Renderizado visual interactivo (diagramas de flujo, esquemas de bases de datos relacionales, secuencias de autenticación) con zoom y exportación en PNG/SVG.

---

### 28. Reconocimiento de Identidad por Voz (Speaker Verification)
- [ ] **Perfilado y autorización por huella acústica**:
	- Análisis del timbre de voz en el microservicio Vosk / STT.
	- Discriminación de identidad para cargar memorias personales, permisos de domótica y notas privadas únicamente si habla el usuario autorizado (Hassan).

---

## 🧠 Fase 9: Plan-and-Solve con Caché Limpia, Mata-Silencio de Cero Coste y Memoria en Árbol (`TreeNode`)

### 29. Flujo de Planificación Adaptativo Multi-Paso ("Plan-and-Solve") con Aislamiento de Caché
- [ ] **Activación Condicional Exclusiva para Peticiones Complejas**:
	- Solo se activa la ruta de planificación si el orquestador detecta que la solicitud requiere múltiples fuentes o pasos secuenciales (ej. *"planifica mi cumpleaños y mira el tiempo en Barcelona"*). Las consultas directas o simples responden inmediatamente por el flujo habitual sin sobrecarga.
- [ ] **Generación y Desglose de Lista de Pasos (Step-by-Step Task Dict)**:
	- **Paso 1 (Carga de Caché)**: Carga el prompt base precalentado en RAM.
	- **Paso 2 (Planificación)**: Genera una lista estructurada (`dict`) con las tareas necesarias y el prompt final de resolución.
	- **Paso 3 (Ejecución Aislada con Caché Limpia)**:
		- Cada subtarea se despacha en un **entorno limpio con nuevo contexto/caché**.
		- Evita la saturación de memoria RAM y la degradación de inferencia al no arrastrar tokens ni historiales innecesarios.
	- **Paso 4 (Paso de Datos Específicos)**:
		- El resultado de cada paso se registra en el diccionario.
		- Si una tarea posterior depende de un resultado anterior, se le inyecta únicamente ese dato concreto sin contaminar el resto del contexto.
	- **Paso 5 (Síntesis Exhaustiva Final)**:
		- Una vez completados todos los pasos, se recarga la caché principal con el prompt de cierre para emitir la respuesta final.
		- **Preservación total de datos**: Directrices estrictas en prompts que prohíben términos reductores (*"resumen"*, *"conclusión"*) y exigen un *"informe estructurado y exhaustivo"* que conserve cifras, fechas, precios y entidades clave.
	- **Control de Concurrencia en `.env` (`AGENT_EXECUTION_MODE=sequential|parallel`)**:
		- En Raspberry Pi 5 se fuerza ejecución estrictamente secuencial para mantener el procesador en rangos térmicos óptimos y sin saturar hilos.
		- En entornos más potentes permite paralelización de tareas independientes.
- [ ] **Persistencia Limpia en Historial y Enlace al RAG**:
	- Al finalizar todo el flujo, la investigación completa se archiva estructurada en el RAG.
	- El historial activo del chat conserva únicamente la pregunta inicial del usuario y la respuesta final con su enlace/referencia interna al RAG (sin contaminar la ventana con los pasos intermedios).
	- En el HTML de la interfaz no se muestran textos técnicos ni enlaces crudos: únicamente se renderiza la respuesta final y un `<div>` colapsado que al pulsarlo despliega todos los pasos de la investigación.

---

### 30. Sistema "Mata-Silencio" de Cero Coste (Reutilización de Tool Payload) y Colapso Visual
- [ ] **Feedback inmediato al usuario (< 10 palabras) sin doble inferencia**:
	- **Cero coste computacional**: No se genera inferencia adicional. El orquestador extrae directamente el parámetro/intención que el modelo ya generó para la herramienta (ej. de `web_search(query="tiempo fin de semana barcelona")` se extrae *"Buscando: tiempo fin de semana barcelona"*).
	- Se envía al usuario de forma instantánea por WebSocket (< 10 palabras) para eliminar el silencio y la incertidumbre.
	- Al finalizar cada subtarea de la lista de pasos, emite un aviso de estado corto (< 10 palabras) informando del hito completado.
- [ ] **Agrupación y Colapso Visual en el Frontend**:
	- Todos los pasos intermedios, logs de herramientas y llamadas técnicas se empaquetan en la interfaz dentro de un contenedor colapsable con botón (*"Ver pasos de la investigación [N]"*).
	- La interfaz muestra limpia y en primer plano la respuesta final estructurada.

---

### 31. Ramas de Conversación (Branching) y Ventana Deslizante Estricta de 10 Mensajes
- [ ] **Ramas de Historial de Chat (Conversation Branching)**:
	- Capacidad de ramificar o bifurcar una conversación en diferentes caminos temáticos independientes.
	- Cada rama mantiene su propio historial de turnos recientes y sus propios punteros al árbol de memoria RAG.
- [ ] **Ventana deslizante de 10 mensajes (5 turnos de usuario + 5 de asistente)**:
	- El contexto activo del chat se limita estrictamente a los últimos 5 intercambios completos para garantizar predictibilidad absoluta de tokens y prevenir el cuello de botella $O(N^2)$ en la RPi5.
- [ ] **Desruidado periódico cada 5 mensajes**:
	- Mecanismo en segundo plano que analiza los últimos 5 turnos y purga preguntas aisladas o descartables (ej. cálculos o consultas casuales como *"¿cuánto es 5x7?"* durante la organización de un viaje) para que no ensucien el historial ni contaminen la indexación de memoria.

---

### 32. Memoria RAG Jerárquica en Árbol de 3 Niveles (`TreeNode`) y Foco Dinámico
- [ ] **Estructura Jerárquica `TreeNode` en Redis**:
	- Almacenamiento del conocimiento acumulado en una estructura de 3 niveles:
		- **Nivel 1 (Tema Principal / Raíz)**: Ej. `cumpleaños`, `fisica cuantica`.
		- **Nivel 2 (Subtemas / Hijos)**: Ej. `restaurante`, `invitacion`, `patron de interferencia`.
		- **Nivel 3 (Detalles / Nietos)**: Ej. `casa carmen`, `kfc`, `luis`, `borrador cuantico`.
- [ ] **Proyección Dinámica de Contexto en el Prompt**:
	- **Tema Activo (En foco de la conversación actual)**:
		- Se expanden los 3 niveles completos (Raíz $\rightarrow$ Hijos $\rightarrow$ Nietos) con todos los datos y entidades.
	- **Temas Inactivos (Históricos de la sesión)**:
		- Se muestran colapsados en 1 sola línea por tema listando sus ramas principales para que el modelo sepa que existen sin gastar tokens:
		  `[datos en RAG]:`
		  `- cumpleaños: restaurante, invitacion`
		  `- fisica cuantica: patron de interferencia, borrador cuantico`
- [ ] **Detección de Foco y Transición sin Fricción**:
	- El orquestador evalúa si la consulta del usuario apunta a la ventana activa o si hace referencia a un nodo archivado.
	- Si el usuario cambia bruscamente de tema (ej. de *cuántica* pasa a *"¿qué restaurante habíamos visto?"*), el gestor activa el nodo `cumpleaños`, expande sus 3 niveles y contrae `fisica cuantica` a 1 línea.
- [ ] **Acción manual de archivo**:
	- Botón en la interfaz web para consolidar o archivar la rama activa directamente en el árbol `TreeNode` de RAG cuando el usuario lo decida.

