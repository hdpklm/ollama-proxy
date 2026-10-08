## Conclusión: Arquitectura de Proxy con Prioridad Absoluta

Para una Raspberry Pi 5 (8GB RAM sin VRAM dedicada), delegar la concurrencia a servidores genéricos resulta en bloqueos y saturación de memoria. La arquitectura óptima es construir el proxy en Python usando `llama-cpp-python`, manteniendo **un único modelo base en memoria de solo lectura** e implementando un **Scheduler (Planificador) con Interrupción por Token**.

Al detectar el parámetro `"priority": true` en el JSON entrante, el servidor rompe el flujo del usuario de baja prioridad, libera el procesador para resolver la petición urgente al 100% de velocidad, y posteriormente reanuda la tarea pausada pasándole el texto acumulado para que continúe por donde iba.

---

## Cómo calcular el consumo de RAM del Contexto (KV Cache)

El "KV Cache" es la memoria de trabajo temporal donde el modelo almacena los tokens procesados. A diferencia del modelo (que pesa gigas), el KV Cache pesa megas y depende linealmente de la cantidad de texto (contexto).

Para un modelo estándar de 8B parámetros (como Llama-3 8B), la fórmula matemática a 16-bits (FP16) es:

> **Fórmula:** `Capas × (Dimensión_Oculta / Ratio_GQA) × Tokens_Contexto × 4 bytes`

Para simplificarlo en código: un modelo 8B moderno consume aproximadamente **0.125 MB por cada Token**.

* Un contexto de 1024 tokens = ~128 MB de RAM.
* Un contexto de 4096 tokens = ~512 MB de RAM.

---

## Código Python Completo (El Proxy de Prioridades)

Este código levanta un servidor web (Proxy) utilizando Flask. Puedes hacerle peticiones HTTP POST mandando tu JSON con el parámetro `"priority": true`.

**Requisitos previos:**

```bash
pip install llama-cpp-python flask

```

**Archivo: `proxy_prioridad.py**`

```python
import time
import threading
from flask import Flask, request, jsonify
from llama_cpp import Llama

app = Flask(__name__)

# ==========================================
# 1. CARGA GLOBAL DEL MODELO (Solo Lectura)
# ==========================================
print("Cargando modelo en memoria (Esto tomará unos segundos)...")
llm = Llama(
    model_path="./modelos/llama-3-8b-instruct-Q4_K_M.gguf", # Cambia esto a tu ruta GGUF
    n_ctx=4096,   # Contexto máximo total permitido
    n_threads=4,  # Usa los 4 núcleos de la Raspberry Pi 5
    verbose=False
)

# Bandera global para controlar el Scheduler
high_priority_active = False

# ==========================================
# 2. UTILIDADES
# ==========================================
def calcular_kv_ram_mb(n_tokens):
    """
    Calcula los Megabytes que consumirá el KV Cache en la RAM.
    Basado en la arquitectura GQA de un modelo 8B (aprox 0.125 MB por token).
    """
    MB_POR_TOKEN = 0.125
    return round(n_tokens * MB_POR_TOKEN, 2)

# ==========================================
# 3. ENDPOINT DEL PROXY
# ==========================================
@app.route('/api/generate', methods=['POST'])
def generate():
    global high_priority_active
    
    data = request.json
    prompt = data.get("prompt", "")
    es_urgente = data.get("priority", False)
    max_tokens = data.get("max_tokens", 100)
    
    # Calcular RAM necesaria para esta petición (Tokens de entrada + salida esperada)
    tokens_entrada = len(llm.tokenize(prompt.encode('utf-8')))
    tokens_totales = tokens_entrada + max_tokens
    ram_estimada_mb = calcular_kv_ram_mb(tokens_totales)

    # -------------------------------------------
    # RUTA A: ALTA PRIORIDAD
    # -------------------------------------------
    if es_urgente:
        # Avisar al resto de hilos que paren y soltar la CPU
        high_priority_active = True
        time.sleep(0.3) # Dar margen para que el hilo de baja prioridad se detenga
        
        print(f"\n[ALTA PRIORIDAD] 🚀 Procesando petición urgente... (RAM KV: {ram_estimada_mb} MB)")
        inicio = time.time()
        
        # Generar usando el 100% de la CPU (bloquea internamente C++)
        respuesta = llm(prompt, max_tokens=max_tokens)
        texto_final = respuesta['choices'][0]['text']
        
        # Bajar la bandera para que los pausados continúen
        high_priority_active = False
        
        return jsonify({
            "response": texto_final,
            "priority": True,
            "kv_cache_ram_mb": ram_estimada_mb,
            "time_seconds": round(time.time() - inicio, 2)
        })

    # -------------------------------------------
    # RUTA B: BAJA PRIORIDAD (Con Interrupción)
    # -------------------------------------------
    else:
        print(f"\n[BAJA PRIORIDAD] 🐢 Iniciando petición de fondo... (RAM KV: {ram_estimada_mb} MB)")
        inicio = time.time()
        
        texto_actual = prompt
        tokens_generados = 0
        pausas_sufridas = 0
        motivo_parada = None

        while tokens_generados < max_tokens:
            # 1. Modo Espera: Si hay algo urgente, el bucle se queda aquí sin gastar CPU
            while high_priority_active:
                pausas_sufridas += 1
                time.sleep(0.5)

            # 2. Generación en Streaming: Pedimos la continuación al modelo
            tokens_restantes = max_tokens - tokens_generados
            stream = llm(texto_actual, max_tokens=tokens_restantes, stream=True)
            
            for chunk in stream:
                # 3. Interrupción en tiempo real: Si cambia la bandera, rompemos el stream
                if high_priority_active:
                    print("\n[BAJA PRIORIDAD] ⏸️ Pausado por petición urgente...")
                    break 

                # Extraer token y acumular
                token = chunk['choices'][0]['text']
                texto_actual += token
                tokens_generados += 1
                motivo_parada = chunk['choices'][0]['finish_reason']

                # Si el modelo decide que ya ha terminado la frase, salimos
                if motivo_parada is not None:
                    break
            
            # Si se paró de forma natural (no por interrupción), rompemos el bucle While mayor
            if motivo_parada is not None:
                break

        # Extraer solo la respuesta (quitando el prompt inicial)
        texto_final = texto_actual[len(prompt):]

        print("\n[BAJA PRIORIDAD] ✅ Completado tras", pausas_sufridas, "pausas.")
        return jsonify({
            "response": texto_final,
            "priority": False,
            "kv_cache_ram_mb": ram_estimada_mb,
            "times_paused": pausas_sufridas,
            "time_seconds": round(time.time() - inicio, 2)
        })

if __name__ == '__main__':
    # Levantar el proxy en el puerto 11434 (para simular a Ollama)
    # threaded=True permite recibir múltiples peticiones HTTP simultáneas
    app.run(host='0.0.0.0', port=11434, threaded=True)

```

### Cómo probar tu nuevo Proxy

Haz una petición normal (tardará más):

```bash
curl -X POST http://127.0.0.1:11434/api/generate \
-H "Content-Type: application/json" \
-d '{"prompt": "Escribe una historia muy larga sobre Roma", "priority": false, "max_tokens": 300}'

```

Mientras la primera está corriendo en tu terminal, abre otra terminal y lanza el ataque de alta prioridad:

```bash
curl -X POST http://127.0.0.1:11434/api/generate \
-H "Content-Type: application/json" \
-d '{"prompt": "Di Hola", "priority": true, "max_tokens": 10}'

```

Verás en la consola del servidor cómo la primera petición detiene inmediatamente su consumo de CPU, se procesa el "Di Hola" a máxima velocidad, y acto seguido, la historia sobre Roma se reanuda enviando al modelo el texto acumulado, recalculando el KV Cache internamente de forma muy rápida y terminando su tarea.