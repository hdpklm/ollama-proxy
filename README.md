# Ollama Priority Proxy

Proxy HTTP inteligente con **planificador estricto de tokens por turno** (*Strict Preemptive Token Scheduler*) sobre `llama-cpp-python`. Permite ejecutar solicitudes normales (baja prioridad) e intercalar solicitudes urgentes (alta prioridad) de forma inmediata, dedicando el 100% de la CPU al trabajo urgente sin reiniciar ni cortar la conexión del trabajo previo.

---

## Características Principales

- **Planificación a Nivel de Token**: Cada tick evalúa la cola de alta prioridad; si hay un token urgente listo, se computa de inmediato pausando la tarea de baja prioridad.
- **Doble Contexto con Pesos Compartidos**: Un único modelo cargado en memoria de solo lectura (`mmap`) con dos contextos KV independientes (`llm_high` y `llm_low`).
- **Cero Pérdida de Progreso**: La tarea en segundo plano no se aborta ni se reinicia; reanuda exactamente en el token donde se quedó.
- **Compatible con OpenAI y Ollama**: Endpoints `/v1/chat/completions`, `/v1/completions` y `/api/generate`.
- **Independiente de Ollama**: Carga modelos `.gguf` locales directamente.

---

## Requisitos

- Python 3.10 o superior.
- Gestor de paquetes recomendado: [uv](https://docs.astral.sh/uv/) (o `pip`).
- Compilador C/C++ compatible (`gcc`/`clang` en Linux, Visual Studio C++ Build Tools en Windows).

---

## Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/ollama-proxy.git
cd ollama-proxy
```

### 2. Instalar dependencias con uv (Recomendado)
```bash
uv sync
```

*(Alternativa con pip tradicional)*:
```bash
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
pip install -r pyproject.toml
```

---

## Cómo Descargar Modelos (Sin Necesidad de Ollama)

No necesitas tener Ollama instalado en tu máquina o Raspberry Pi. El proxy lee directamente archivos en formato estándar **GGUF** desde la carpeta `./modelos/` o la ruta que indiques.

### Opción A: Descarga directa desde Hugging Face con curl o wget

Crea la carpeta de modelos en la raíz del proyecto:
```bash
mkdir modelos
```

Descarga un modelo cuantizado (ejemplo: Llama-3.2-1B o Qwen-2.5-1.5B en cuantización `Q4_K_M`):

**Linux / macOS / Raspberry Pi**:
```bash
# Llama 3.2 1B Instruct (Recomendado para Raspberry Pi 5)
wget -O modelos/llama-3.2-1b-instruct-q4_k_m.gguf \
  https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf

# O bien Qwen 2.5 1.5B Instruct
wget -O modelos/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf
```

**Windows (PowerShell o CMD con curl)**:
```cmd
curl -L -o modelos\llama-3.2-1b-instruct-q4_k_m.gguf ^
  https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf
```

### Opción B: Usar huggingface-cli
```bash
uv run huggingface-cli download bartowski/Llama-3.2-1B-Instruct-GGUF \
  Llama-3.2-1B-Instruct-Q4_K_M.gguf \
  --local-dir ./modelos --local-dir-use-symlinks False
```

### Opción C: Reutilizar modelos ya descargados por Ollama (Opcional)
Si ya tienes modelos descargados en Ollama local, puedes apuntar directamente a su archivo blob en el archivo `.env`.

---

## Configuración (`.env`)

Crea o edita el archivo `.env` en la raíz del proyecto:

```env
# Clave de autenticacion para endpoints /v1/* (dejar vacio si no requiere clave)
PROXY_API_KEY=cambia_esta_clave

# Ruta absoluta o relativa al modelo GGUF
MODEL_PATH=./modelos/llama-3.2-1b-instruct-q4_k_m.gguf

# Longitud maxima de contexto (en tokens)
N_CTX=2048

# Numero de hilos de CPU dedicados a la inferencia (en RPi5 poner 4)
N_THREADS=4
```

---

## Cómo Arrancar el Proxy

### En Windows
Puedes usar el script incluido:
```cmd
run.bat
```
O mediante línea de comandos:
```cmd
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### En Linux / Raspberry Pi 5
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

El servidor estará escuchando en `http://0.0.0.0:8000`.

---

## Cómo Usar el Proxy

### 1. Petición Normal (Baja Prioridad)
Por defecto, las peticiones entran con prioridad normal:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cambia_esta_clave" \
  -d '{
    "model": "local",
    "messages": [{"role": "user", "content": "Escribe un ensayo largo sobre el espacio."}],
    "priority": false
  }'
```

### 2. Petición Urgente (Alta Prioridad - Interrupción Preventiva)
Añade `"priority": true` en el payload. El planificador pausará la petición anterior en el siguiente token generado y dedicará el 100% de la CPU a responder esta petición:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cambia_esta_clave" \
  -d '{
    "model": "local",
    "messages": [{"role": "user", "content": "URGENTE: Dime que hora es o responde si/no."}],
    "priority": true
  }'
```

### 3. Endpoint Nativo Ollama (`/api/generate`)
```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Respuesta rapida",
    "priority": true,
    "max_tokens": 100
  }'
```

---

## Scripts de Prueba Concurrente

Dentro de la carpeta `test_win/` dispones de scripts para comprobar la interrupción preventiva:
- `python test_win/normal.py`: Lanza una tarea larga en segundo plano.
- `python test_win/urgente.py`: Dispara una tarea urgente mientras la normal sigue corriendo.
