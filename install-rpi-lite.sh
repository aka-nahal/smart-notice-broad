#!/usr/bin/env bash
# RunaNet kiosk installer for Raspberry Pi OS Lite (Bookworm, 64-bit).
#
# What this sets up:
#   1. System packages: cage (Wayland kiosk compositor), Chromium, Node.js,
#      picamera2 + OpenCV for the presence detector, supporting libs.
#   2. Camera: enables camera_auto_detect in /boot/firmware/config.txt if off,
#      and adds the kiosk user to the video + render groups so libcamera works
#      without root.
#   3. Python venv in ./.venv with --system-site-packages so picamera2 (which
#      is only available as an apt package) is importable inside the venv.
#   4. Backend dependencies (FastAPI etc.) installed into the venv.
#   5. Frontend dependencies + production build (first boot only).
#   6. Systemd service /etc/systemd/system/runanet-kiosk.service that takes
#      over tty1, starts cage, and runs the launcher - auto-starts on boot,
#      restarts on crash, no desktop environment needed.
#
# Usage (on the Pi, as the kiosk user - usually 'pi'):
#     cd ~/RunaNet && bash install-rpi-lite.sh
#     sudo reboot
#
# Re-running the script is safe; it only installs what's missing and
# overwrites the service unit each time.
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "This installer targets Raspberry Pi OS Lite. Refusing on $(uname -s)."
    exit 1
fi
if [[ $EUID -eq 0 ]]; then
    echo "Run as your regular user (the one that will own the kiosk), not root."
    exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="$USER"
USER_UID="$(id -u)"

echo "=== RunaNet kiosk install (RPi OS Lite) ==="
echo "  user: $USER_NAME  uid: $USER_UID"
echo "  repo: $REPO_DIR"
echo

# ── 1. APT packages ──────────────────────────────────────────────────────────
# - cage:                 the kiosk compositor
# - chromium-browser:     the browser that will render /display in --kiosk
# - rpicam-apps:          provides rpicam-vid/hello/still - the CLI stack the
#                         presence detector pipes YUV frames from. Ships on
#                         standard Pi OS images; listed here for Lite minimal.
# - python3-opencv:       Haar-cascade face detector - apt build is neon-tuned
# - nodejs / npm:         Next.js frontend
# - libgl1, libglib2.0-0: opencv runtime deps (usually already present)
# - seatd + polkit:       let a non-root user open DRM + input devices for cage
echo "--> Installing apt packages (this may take a few minutes)"
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
    cage \
    chromium-browser \
    fonts-dejavu-core \
    libgl1 libglib2.0-0 \
    nodejs npm \
    python3-venv python3-pip python3-dev \
    python3-opencv python3-numpy \
    rpicam-apps \
    seatd policykit-1 \
    xdg-utils

# Node 18+ is required by Next.js 14. Bookworm ships 18.19 by default.
node_major="$(node -v 2>/dev/null | sed 's/^v//;s/\..*//')"
if [[ -z "$node_major" || "$node_major" -lt 18 ]]; then
    echo "WARN: Node $node_major detected; Next.js 14 needs >= 18."
    echo "      If the frontend build fails, install Node 20 from nodesource."
fi

# ── 2. Camera enablement ─────────────────────────────────────────────────────
echo "--> Ensuring camera is enabled"
CONFIG_TXT=/boot/firmware/config.txt
if [[ ! -f "$CONFIG_TXT" ]]; then
    CONFIG_TXT=/boot/config.txt  # pre-Bookworm fallback
fi
if ! grep -q '^camera_auto_detect=1' "$CONFIG_TXT"; then
    echo "    enabling camera_auto_detect in $CONFIG_TXT"
    sudo sed -i '/^camera_auto_detect=/d' "$CONFIG_TXT"
    echo 'camera_auto_detect=1' | sudo tee -a "$CONFIG_TXT" >/dev/null
    CAMERA_CHANGED=1
fi

# Needed so our user can open /dev/video* and the DRM render node.
for grp in video render input; do
    if ! id -nG "$USER_NAME" | grep -qw "$grp"; then
        echo "    adding $USER_NAME to $grp"
        sudo usermod -aG "$grp" "$USER_NAME"
        GROUP_CHANGED=1
    fi
done

# ── 3. Python venv ───────────────────────────────────────────────────────────
# --system-site-packages exposes apt-installed picamera2/opencv inside the
# venv. Without it, the detector would fall back to "no camera" silently.
VENV="$REPO_DIR/.venv"
if [[ ! -d "$VENV" ]]; then
    echo "--> Creating venv (.venv, with system-site-packages)"
    python3 -m venv --system-site-packages "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip

# ── 4. Backend dependencies ──────────────────────────────────────────────────
echo "--> Installing backend dependencies"
"$VENV/bin/pip" install -q -r "$REPO_DIR/backend/requirements.txt"

# pywebview is optional on Lite (cage+Chromium is the actual window). Skip it.
touch "$REPO_DIR/data/.pywebview-install-skipped" 2>/dev/null || \
    mkdir -p "$REPO_DIR/data" && echo "$(python3 -c 'import sys;print(f"{sys.version_info[0]}.{sys.version_info[1]}")')" > "$REPO_DIR/data/.pywebview-install-skipped"

# ── 5. Frontend (first-time build) ───────────────────────────────────────────
if [[ ! -d "$REPO_DIR/frontend/node_modules" ]]; then
    echo "--> Installing frontend deps"
    ( cd "$REPO_DIR/frontend" && npm install --silent )
fi
if [[ ! -f "$REPO_DIR/frontend/.next/BUILD_ID" ]]; then
    echo "--> Building frontend for production (first run only, ~5-10 min on a Pi)"
    ( cd "$REPO_DIR/frontend" && npm run build )
fi

# ── 6. Systemd service ───────────────────────────────────────────────────────
echo "--> Installing systemd service"
UNIT_SRC="$REPO_DIR/runanet-kiosk.service"
UNIT_DST=/etc/systemd/system/runanet-kiosk.service
# __USER__ / __UID__ / __PYTHON__ are placeholders; we materialise them here
# so the unit is portable across users and repo locations.
sudo sed \
    -e "s|__USER__|$USER_NAME|g" \
    -e "s|__UID__|$USER_UID|g" \
    -e "s|__PYTHON__|$VENV/bin/python|g" \
    -e "s|/home/$USER_NAME/RunaNet|$REPO_DIR|g" \
    "$UNIT_SRC" | sudo tee "$UNIT_DST" >/dev/null

# getty@tty1 would fight cage for the console - disable it.
sudo systemctl disable getty@tty1.service 2>/dev/null || true

sudo systemctl daemon-reload
sudo systemctl enable runanet-kiosk.service

echo
echo "=== Done. ==="
echo
if [[ "${CAMERA_CHANGED:-}" == "1" || "${GROUP_CHANGED:-}" == "1" ]]; then
    echo "  The camera-config or group changes need a reboot:"
    echo "    sudo reboot"
    echo
fi
echo "  Start now:     sudo systemctl start runanet-kiosk"
echo "  Live logs:     journalctl -u runanet-kiosk -f"
echo "  Stop / disable:sudo systemctl disable --now runanet-kiosk"
echo "  Test camera:   libcamera-hello --list-cameras"
echo
echo "  Open /display from another machine to verify before going full kiosk:"
echo "    http://$(hostname -I | awk '{print $1}'):3000/display"
