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

