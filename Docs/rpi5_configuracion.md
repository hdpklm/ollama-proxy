# Configuración y Ajustes del Sistema - Raspberry Pi 5

Este documento detalla la configuración del sistema operativo, almacenamiento NVMe, red, administración de energía y diagnóstico aplicada en la Raspberry Pi 5 (`ras` / `192.168.1.200`).

---

## 1. Conectividad y Red Wi-Fi

### Diagnóstico de Pérdida de Conexión (Registro del Log a las 04:06 - 04:35 AM)
El registro del sistema (`journalctl -b -1`) reveló el motivo por el cual la Raspberry Pi 5 quedaba inaccesible tras horas de actividad:
1. **Reinicio/Reseteo nocturno del Router**:
   A las `04:06:11 GMT`, el router doméstico reinició o resincronizó la radio 5 GHz, emitiendo un rechazo temporal:
   ```text
   wlan0: CTRL-EVENT-ASSOC-REJECT status_code=16
   ```
2. **Abandono de Reintentos de NetworkManager**:
   Por defecto, `connection.autoconnect-retries` estaba fijado en `-1` (límite de 4 intentos). Tras 4 intentos fallidos en la banda de 5 GHz, a las `04:35:54 GMT` NetworkManager abandonó definitivamente la conexión:
   ```text
   device (wlan0): state change: config -> failed (reason 'no-secrets')
   device (wlan0): state change: failed -> disconnected
   ```
   A partir de ese instante, la RPi5 quedó sin interfaz de red activa. El sistema Linux continuó funcionando sin fallos hasta las `12:20:54 GMT`, momento en el cual el usuario pulsó el botón físico de encendido (`systemd-logind: Power key pressed short`) para apagarla al no responder a la red.
3. **Restricción Forzada a 5 GHz**:
   La conexión tenía configurado `802-11-wireless.band: a`, impidiendo a la Raspberry Pi conectar a la banda de 2.4 GHz (`inibir-2` en Canal 10, con 75% de señal frente al 55% de los 5 GHz).

### Ajustes Aplicados para Reconexión Automática Indefinida

1. **Reintentos Ilimitados de Conexión**:
   ```bash
   sudo nmcli connection modify inibir-2 connection.autoconnect-retries 0
   ```
   *(Valor `0` = reintentos infinitos sin rendirse jamás).*

2. **Permitir Conexión Dual-Band (2.4 GHz y 5 GHz)**:
   ```bash
   sudo nmcli connection modify inibir-2 802-11-wireless.band ""
   ```
   Permite conmutar automáticamente a la banda de 2.4 GHz (mayor cobertura) si la de 5 GHz se reinicia o pierde señal.

3. **Watchdog Activo de Red (`/usr/local/bin/wifi-watchdog.sh`)**:
   Script automático que comprueba la disponibilidad del router cada 2 minutos vía `/etc/cron.d/wifi-keepalive`:
   ```bash
   #!/bin/bash
   GATEWAY="192.168.1.1"
   CON_NAME="inibir-2"

   if ! ping -c 2 -W 2 "$GATEWAY" >/dev/null 2>&1; then
       logger -t wifi-watchdog "Gateway $GATEWAY unreachable, reconnecting to $CON_NAME"
       nmcli connection up "$CON_NAME" >/dev/null 2>&1
       sleep 5
       if ! ping -c 1 -W 2 "$GATEWAY" >/dev/null 2>&1; then
           logger -t wifi-watchdog "Still unreachable, cycling Wi-Fi radio"
           nmcli radio wifi off
           sleep 2
           nmcli radio wifi on
           sleep 3
           nmcli connection up "$CON_NAME" >/dev/null 2>&1
       fi
   fi
   ```

4. **Desactivación permanente de Wi-Fi Power Management**:
   Regla persistente en `/etc/NetworkManager/conf.d/default-wifi-powersave-disable.conf`:
   ```ini
   [connection]
   wifi.powersave = 2
   ```

---

## 2. Almacenamiento NVMe y Bus PCIe (Verificado en Arranque)

1. **Desactivación de APST (Autonomous Power State Transitions)**:
   Se añadió en `/boot/firmware/cmdline.txt`:
   ```text
   nvme_core.default_ps_max_latency_us=0
   ```
   Impide que el SSD Netac 250GB entre en los modos defectuosos `ps 3` (10 ms) y `ps 4` (45 ms).
   *Verificado en arranque activo*: `nvme_core.default_ps_max_latency_us=0` cargado por el kernel.

2. **Fijación de PCIe en Gen 2 Seguro (5.0 GT/s)**:
   En `/boot/firmware/config.txt`:
   ```ini
   [all]
   dtparam=pciex1
   dtparam=pciex1_gen=2
   ```
   *Verificado en dmesg*: `brcm-pcie 1000110000.pcie: link up, 5.0 GT/s PCIe x1`. No hay errores de enlace ni interferencias de alta frecuencia con Wi-Fi.

---

## 3. Persistencia Real de Logs del Sistema (`systemd-journald`)

1. Se neutralizó `/usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf` redirigiéndolo a `/dev/null`.
2. Se fijó `Storage=persistent` en `/etc/systemd/journald.conf.d/99-persistent.conf`.
3. Todos los arranques se almacenan en el NVMe (`/var/log/journal/5e097716b6a84f05928a0bf8046b4810/system.journal`).
4. Se pueden consultar las causas de cualquier desconexión con:
   ```bash
   journalctl -b -1 -e
   ```

---

## 4. Acceso SSH desde Clientes Windows

En `C:\Users\snipe\.ssh\config` se mantiene el mapeo para el usuario `inibir`:
```ssh-config
Host 192.168.1.200 ras raspberrypi 100.100.1.200
    User inibir
    IdentityFile ~/.ssh/id_ed25519
```
Permitiendo conectar directamente con `ssh 192.168.1.200` o `ssh 100.100.1.200`.
