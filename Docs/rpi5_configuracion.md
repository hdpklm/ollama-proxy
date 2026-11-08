# Configuración y Ajustes del Sistema - Raspberry Pi 5

Este documento detalla la configuración del sistema operativo, red, administración de energía y diagnóstico aplicada en la Raspberry Pi 5 (`ras` / `192.168.1.200`).

---

## 1. Conectividad y Red Wi-Fi

### Problema de Desconexión a las ~6 Horas
Por defecto en Raspberry Pi OS / Debian, el gestor de red (`NetworkManager`) y el controlador Wi-Fi (`brcmfmac` para el chip Broadcom BCM43455/6) tienen activado el modo de ahorro de energía (`Power Management: on`). Cuando la RPi5 está configurada con IP estática manual (`192.168.1.200`), la máquina no envía renovaciones de concesión DHCP. Al cabo de varias horas de inactividad de red o tráfico saliente intermitente, la interfaz Wi-Fi entra en reposo profundo (*power save sleep*), provocando que el router de la LAN dé de baja la asociación del cliente y descarte los paquetes entrantes (ARP y SYN de SSH).

### Ajuste Aplicado (Desactivación Permanente del Ahorro de Energía)
1. **Configuración en NetworkManager para la conexión `inibir-2`**:
   ```bash
   sudo nmcli connection modify inibir-2 802-11-wireless.powersave 2
   ```
   *(Valor `2` = deshabilitar ahorro de energía; `3` = habilitar).*

2. **Regla global persistente para cualquier interfaz Wi-Fi**:
   Archivo `/etc/NetworkManager/conf.d/default-wifi-powersave-disable.conf`:
   ```ini
   [connection]
   wifi.powersave = 2
   ```

3. **Verificación**:
   ```bash
   iwconfig wlan0 | grep "Power Management"
   # Salida esperada: Power Management:off
   ```

---

## 2. Persistencia de Logs del Sistema (`journald`)

### Problema de Pérdida de Registros tras Cuelgues
Por defecto, Raspberry Pi OS almacena los logs de `systemd-journald` en `/run/log/journal` (sistema de archivos en memoria RAM volátil). Cuando la Raspberry Pi se congela o se reinicia eléctricamente, todo el historial de fallos se pierde y el comando `journalctl -b -1` devuelve:
```text
Specifying boot ID or boot offset has no effect, no persistent journal was found.
```

### Ajuste Aplicado (Persistencia en NVMe)
1. **Creación del directorio de journal persistente**:
   ```bash
   sudo mkdir -p /var/log/journal
   sudo systemd-tmpfiles --create --prefix /var/log/journal
   sudo systemctl restart systemd-journald
   ```
2. **Uso para diagnóstico de cuelgues**:
   Tras cualquier reinicio imprevisto, se pueden consultar los últimos eventos del arranque previo con:
   ```bash
   journalctl -b -1 -e
   ```

---

## 3. Acceso SSH desde Clientes Windows

### Problema de Permisos (`Permission denied`)
Al ejecutar `ssh 192.168.1.200` desde una terminal de Windows sin especificar usuario, el cliente SSH utiliza por defecto el nombre de usuario local de Windows (`snipe`), el cual no existe en la Raspberry Pi.

### Ajuste Aplicado en Cliente
En `C:\Users\snipe\.ssh\config` se ha definido el mapeo de host:
```ssh-config
Host 192.168.1.200 ras raspberrypi 100.100.1.200
    User inibir
    IdentityFile ~/.ssh/id_ed25519
```
Permitiendo conectar directamente con:
```cmd
ssh 192.168.1.200
```
O vía Tailscale:
```cmd
ssh 100.100.1.200
```

---

## 4. Recursos y Presión de Memoria RAM

### Diagnóstico de Consumo
* **Memoria Total**: 7.9 GiB (RPi5 8GB).
* **Consumo Base de Contenedores**: ~5.4 GiB (con `ollama-proxy`, `interface`, `vosk-stt`, `piper-tts`, `web-tools` y `redis` en ejecución).
* **Memoria Libre**: ~290 MiB libres en reposo, con ~2.2 GiB en caché/buffer y ~2.0 GiB en partición swap `zram0`.
* **Riesgo Identificado**: Si se ejecutan tareas intensivas sin control de contexto, la memoria puede saturar zram y provocar `zram-writeback` intensivo al disco NVMe (`/dev/nvme0n1p2`), elevando el `I/O wait` de CPU y congelando los servicios de red.

