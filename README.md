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

### 2. Instalación General Rápida
```bash
uv sync
```

---

## Guía Paso a Paso: Compilación Nativa en Raspberry Pi 5 (Máxima Velocidad)

Para exprimir al 100% las instrucciones vectoriales por hardware del procesador **Cortex-A76 (ARM NEON y DotProd)** y superar la velocidad de Ollama, sigue estos pasos en Raspberry Pi OS:

### Paso 1: Instalar herramientas de compilación del sistema
```bash
sudo apt update
sudo apt install -y build-essential cmake
```

### Paso 2: Instalar `uv` (si no lo tienes instalado)
Raspberry Pi OS no incluye `uv` de serie. Instálalo y carga sus rutas:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
```

### Paso 3: Crear y activar el entorno virtual
> [!IMPORTANT]
> `uv` requiere un entorno virtual activo antes de compilar o instalar paquetes para no romper el sistema. Si no lo activas, recibirás el error `error: No virtual environment found`.

```bash
cd ollama-proxy
uv venv
source .venv/bin/activate
```
*(Verás que tu terminal ahora empieza con `(ollama-proxy)` o `(venv)`).*

### Paso 4: Compilar `llama-cpp-python` con aceleración por hardware
```bash
CMAKE_ARGS="-DGGML_NATIVE=on" uv pip install --no-binary llama-cpp-python --force-reinstall llama-cpp-python
```

> [!NOTE]
> **Tiempo de espera y uso de MicroSD**:
> - En una tarjeta MicroSD, la compilación tardará entre **8 y 15 minutos** con los 4 núcleos al 100% y el Swap activo (es normal ver el Swap al 50%-70% mientras GCC compila las tablas C++).
> - Verás el mensaje `⠸ Preparing packages... | Building llama-cpp-python`. **No lo canceles ni toques la consola**: el sistema no está colgado, solo está terminando de ensamblar el motor.
> - Este proceso solo se hace **una sola vez**. Luego, al ejecutar el proxy, todo corre en memoria RAM a máxima velocidad.

### Paso 5: Instalar el resto de dependencias del proxy
Una vez terminada la compilación de `llama-cpp-python`, instala el resto de librerías del proyecto:
```bash
uv pip install fastapi uvicorn pydantic python-dotenv httpx
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

# Longitud maxima de contexto para peticiones normales (en tokens)
N_CTX=2048

# Longitud maxima de contexto para peticiones urgentes (alta prioridad)
N_CTX_HIGH=2048

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
chmod +x run.sh
./run.sh
```
O manualmente:
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### Con Docker Compose (Recomendado)
El proyecto incluye un [docker-compose.yml](file:///c:/work/person/hassan/Repos/ollama-proxy/docker-compose.yml) listo para producción, montando automáticamente la carpeta de modelos en solo lectura y leyendo tu `.env`:

```bash
# Construir e iniciar en segundo plano:
docker compose up -d --build

# Ver los logs en tiempo real:
docker compose logs -f

# Detener el contenedor:
docker compose down
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

### 4. Modo Rápido por Petición (`"fast": true`)
Si necesitas la máxima velocidad en una petición específica sin perder precisión en el resto:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cambia_esta_clave" \
  -d '{
    "model": "local",
    "messages": [{"role": "user", "content": "Responde rapido"}],
    "fast": true
  }'
```
Al activar `"fast": true`, el decodificador salta el cálculo de probabilidades multinomiales complejas (*greedy sampling* `top_k=1`), acelerando la generación de tokens por segundo.

---

## Optimización de Rendimiento y Overclock en Raspberry Pi 5

### 1. Activar Modo Performance en RAM (Sin tocar archivos)
Para que los 4 núcleos de la RPi 5 trabajen a 2.4 GHz fijos sin caídas de frecuencia:
```bash
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```
*(Para volver al modo ahorro normal: cambiar `performance` por `ondemand`). No se guarda al reiniciar.*

---

### 2. Overclock Seguro a 2.8 GHz (+16% de velocidad matemática)
> [!IMPORTANT]
> Requiere disipador activo (*Active Cooler* oficial de Raspberry Pi).

Edita el archivo de arranque del firmware:
```bash
sudo nano /boot/firmware/config.txt
```
Añade al final del archivo:
```ini
[all]
arm_freq=2800
```
Guarda (`Ctrl+O`, `Enter`) y sal (`Ctrl+X`). Luego reinicia:
```bash
sudo reboot
```

---

### 3. Cómo Restaurar el Overclock si Falla o no Arranca

Si por algún motivo la Raspberry Pi no arranca tras cambiar la frecuencia, recuperarla toma 1 minuto:

#### Método A: Desde tu ordenador (Windows / Linux / Mac)
1. Apaga la Raspberry Pi y extrae la tarjeta MicroSD (o el SSD/USB).
2. Conéctala a tu ordenador. Verás una unidad llamada `bootfs` o simplemente un disco con archivos.
3. Abre el archivo `config.txt` con el Bloc de notas.
4. Borra la línea `arm_freq=2800` (o pon `arm_freq=2400`).
5. Guarda el archivo, vuelve a colocar la MicroSD en la Raspberry Pi y arrancará inmediatamente como de fábrica.

#### Método B: Modo Seguro con el botón de encendido (Hardware)
1. Desconecta el cable de alimentación de la Raspberry Pi 5.
2. **Mantén presionado el botón de encendido físico** de la Raspberry Pi 5.
3. Conecta el cable de alimentación mientras mantienes el botón presionado durante 3 segundos.
4. La Raspberry Pi 5 detectará la pulsación forzada y arrancará en **Modo Seguro (Safe Mode)** ignorando el overclock para que puedas entrar por SSH o pantalla y corregir el archivo.

---

## Scripts de Prueba Concurrente

Dentro de la carpeta `test_win/` dispones de scripts para comprobar la interrupción preventiva y medir tokens por segundo:
- `python test_win/normal.py`: Lanza una tarea larga en segundo plano mostrando métricas en streaming.
- `python test_win/urgente.py`: Dispara una tarea urgente mientras la normal sigue corriendo.
