# Configuración y Ajustes del Sistema - Raspberry Pi 5

Este documento detalla la configuración del sistema operativo, almacenamiento NVMe, red, administración de energía y diagnóstico aplicada en la Raspberry Pi 5 (`ras` / `192.168.1.200`).

---

## 1. Conectividad y Red Wi-Fi

### Problema de Desconexión a las ~5-6 Horas
Por defecto en Raspberry Pi OS / Debian, el gestor de red (`NetworkManager`) y el controlador Wi-Fi (`brcmfmac` para el chip Broadcom BCM43455/6) tienen activado el modo de ahorro de energía (`Power Management: on`). Cuando la RPi5 está configurada con IP estática manual (`192.168.1.200`), la máquina no envía renovaciones de concesión DHCP. Al cabo de varias horas de inactividad de red o tráfico saliente intermitente, la interfaz Wi-Fi entra en reposo profundo (*power save sleep*), provocando que el router de la LAN dé de baja la asociación del cliente y descarte los paquetes entrantes (ARP y SYN de SSH).

### Ajustes Aplicados

1. **Desactivación permanente de Wi-Fi Power Management**:
   ```bash
   sudo nmcli connection modify inibir-2 802-11-wireless.powersave 2
   ```
   Y regla persistente en `/etc/NetworkManager/conf.d/default-wifi-powersave-disable.conf`:
   ```ini
   [connection]
   wifi.powersave = 2
   ```

2. **Keepalive periódico hacia el Gateway (Router)**:
   Para evitar que el router desasocie la RPi tras periodos prolongados sin tráfico saliente, se añadió una tarea en `/etc/cron.d/wifi-keepalive`:
   ```cron
   */2 * * * * root ping -c 1 -W 2 192.168.1.1 >/dev/null 2>&1
   ```

---

## 2. Almacenamiento NVMe y Bloqueo del Bus PCIe (Causa del Parpadeo de Disco)

### Diagnóstico de la Falla del Disco Netac NVMe 250GB
El disco instalado es un **Netac NVMe SSD 250GB** (`SN17027`). Los discos Netac con controladores Silicon Motion / Realtek / Maxio presentan dos incompatibilidades críticas en Linux sobre Raspberry Pi 5:

1. **Estados de Ahorro No Operacionales (APST - Autonomous Power State Transitions)**:
   El controlador declara 5 estados de energía (`ps 0` a `ps 4`). Los estados `ps 3` y `ps 4` son no-operacionales con latencias de salida extremadamente altas (hasta 45 ms):
   * `ps 3`: 0.74W, `exlat: 10000 us` (10 ms)
   * `ps 4`: 0.72W, `exlat: 45000 us` (45 ms)
   Tras ~4 a 6 horas de baja actividad continua, el kernel de Linux envía el disco a reposo profundo `ps 3/4`. Al recibir la siguiente petición de I/O, el controlador Netac falla al despertar dentro de la ventana de tiempo del host PCIe. La controladora Broadcom de la RPi5 entra en bucle infinito de reinicio del bus (haciendo que **la luz del disco parpadee periódicamente sin parar**), la partición raíz `/` se congela y el sistema deja de responder a la red y a SSH.

2. **Inestabilidad de PCIe Gen 3 (8.0 GT/s)**:
   En `/boot/firmware/config.txt` estaba configurado `dtparam=pciex1_gen=3`. La Raspberry Pi Foundation no certifica Gen 3 en el conector PCIe FPC debido a interferencias de alta frecuencia (EMI) con la antena Wi-Fi y riesgo de errores CRC en el bus bajo calor sostenido.

### Ajustes Aplicados en NVMe y Firmware

1. **Desactivar APST en el Kernel (`cmdline.txt`)**:
   En `/boot/firmware/cmdline.txt` se agregó el parámetro:
   ```text
   nvme_core.default_ps_max_latency_us=0
   ```
   Esto fuerza al disco Netac a operar exclusivamente en los modos operacionales de alto rendimiento (`ps 0` a `ps 2`), impidiendo que caiga en los estados `ps 3/4` de suspensión profunda defectuosa.

2. **Fijar PCIe en Gen 2 Seguro y Estable (`config.txt`)**:
   En `/boot/firmware/config.txt` se cambió:
   ```ini
   [all]
   dtparam=pciex1
   dtparam=pciex1_gen=2
   ```
   Garantizando 5.0 GT/s estables sin degradación de señal ni interferencias EMI con la radio Wi-Fi.

---

## 3. Persistencia Real de Logs del Sistema (`systemd-journald`)

### Conflicto con la Configuración por Defecto de Raspberry Pi OS
Raspberry Pi OS incluye de fábrica el archivo `/usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf`, el cual impone `Storage=volatile` forzando a que todos los logs se almacenen únicamente en memoria RAM (`/run/log/journal/`). Esto impedía que `journalctl -b -1` sobreviviera a los reinicios.

### Ajuste Aplicado (Enmascaramiento y Override en NVMe)
1. Se enmascaró la regla volátil redirigiéndola a `/dev/null`:
   ```bash
   sudo ln -sf /dev/null /etc/systemd/journald.conf.d/40-rpi-volatile-storage.conf
   ```
2. Se configuró `/etc/systemd/journald.conf.d/99-persistent.conf`:
   ```ini
   [Journal]
   Storage=persistent
   ```
3. Se inicializó `/var/log/journal/5e097716b6a84f05928a0bf8046b4810/system.journal` en el disco NVMe, permitiendo ahora consultar los eventos de cualquier arranque previo con:
   ```bash
   journalctl -b -1 -e
   ```

---

## 4. Acceso SSH desde Clientes Windows

En `C:\Users\snipe\.ssh\config` se mantiene el mapeo de host para asociar automáticamente el usuario `inibir`:
```ssh-config
Host 192.168.1.200 ras raspberrypi 100.100.1.200
    User inibir
    IdentityFile ~/.ssh/id_ed25519
```
Permitiendo conectar directamente con `ssh 192.168.1.200` o `ssh 100.100.1.200`.

---

## 5. Resumen de Recursos de Memoria RAM
* **Memoria Total**: 7.9 GiB (RPi5 8GB).
* **Consumo Base de Contenedores**: ~5.4 GiB (con `ollama-proxy`, `interface`, `vosk-stt`, `piper-tts`, `web-tools` y `redis` en ejecución).
* **Memoria Libre**: ~290 MiB libres en reposo, ~2.2 GiB en caché/buffer y ~2.0 GiB en partición swap `zram0`.
