#!/usr/bin/env bash
# RunaNet bootstrapper — Raspberry Pi 5 / Debian Trixie.
#
# - Creates backend/.venv on first run
# - Installs backend + display Python deps into the venv
# - Installs frontend node deps on first run
# - Hands off to launcher.py with whatever args you passed
#
# Usage:
#   ./start.sh                   # fullscreen kiosk
#   ./start.sh --no-fullscreen   # windowed (development)
#   ./start.sh --build           # rebuild frontend first
#   ./start.sh --no-presence     # skip camera-based lock screen
#   ./start.sh --no-hotspot      # don't fall back to a Wi-Fi hotspot
#   ./start.sh --clean           # wipe .next + pywebview storage first
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/backend/.venv"
PY="$VENV/bin/python"

# Strip --clean from the args before they're forwarded to launcher.py
# (launcher doesn't know that flag). Filter in-place.
LAUNCHER_ARGS=()
CLEAN=0
for arg in "$@"; do
    if [ "$arg" = "--clean" ]; then
        CLEAN=1
    else
        LAUNCHER_ARGS+=("$arg")
    fi
done

if [ "$CLEAN" = "1" ]; then
    echo "-> Cleaning frontend build cache and webview storage"
    rm -rf "$ROOT/frontend/.next" "$ROOT/data/webview-storage"
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found. Install it: sudo apt install python3 python3-venv" >&2
    exit 1
fi

FRESH_VENV=0
if [ ! -x "$PY" ]; then
    echo "-> Creating venv at $VENV"
    # --system-site-packages so the venv can see PyGObject (`gi`) and any
    # other GTK Python bindings installed by the OS package manager.
    # PyGObject is effectively unbuildable via pip — it needs glib/gobject
    # headers and a working introspection chain — so we always defer to
    # the distro package (python3-gi on Debian, python-gobject on Arch).
    python3 -m venv --system-site-packages "$VENV"
    FRESH_VENV=1
fi

# Older venvs from before the --system-site-packages switch hide system
# packages. Patch pyvenv.cfg in place rather than recreating (which would
# re-install everything from scratch).
PYVENV_CFG="$VENV/pyvenv.cfg"
if [ -f "$PYVENV_CFG" ] && grep -q '^include-system-site-packages = false' "$PYVENV_CFG"; then
    echo "-> Enabling system site-packages in existing venv"
    sed -i 's/^include-system-site-packages = false/include-system-site-packages = true/' "$PYVENV_CFG"
fi

# Hash the requirements files; if they haven't changed since the last
# successful install, skip pip entirely — pip's resolver is slow even
# when there's nothing to do, especially on a Pi over Wi-Fi.
REQ_STAMP="$VENV/.requirements-stamp"
REQ_HASH="$(sha256sum "$ROOT/backend/requirements.txt" "$ROOT/display-requirements.txt" | sha256sum | cut -d' ' -f1)"

if [ "$FRESH_VENV" = "1" ] || [ ! -f "$REQ_STAMP" ] || [ "$(cat "$REQ_STAMP" 2>/dev/null)" != "$REQ_HASH" ]; then
    echo "-> Installing Python dependencies (first run downloads ~100MB; opencv is the big one)"
    "$PY" -m pip install --disable-pip-version-check --upgrade pip
    "$PY" -m pip install --disable-pip-version-check \
        -r "$ROOT/backend/requirements.txt" \
        -r "$ROOT/display-requirements.txt"
    echo "$REQ_HASH" > "$REQ_STAMP"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
    if ! command -v npm >/dev/null 2>&1; then
        echo "npm not found. Install Node.js 18+: sudo apt install nodejs npm" >&2
        exit 1
    fi
    echo "-> Installing frontend dependencies (first run only)"
    (cd "$ROOT/frontend" && npm install --silent)
fi

exec "$PY" "$ROOT/launcher.py" "${LAUNCHER_ARGS[@]+"${LAUNCHER_ARGS[@]}"}"
