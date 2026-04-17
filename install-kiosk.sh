#!/usr/bin/env bash
# RunaNet kiosk installer — Raspberry Pi OS Bookworm (labwc / Wayfire / LXDE).
#
# Sets up:
#   - desktop auto-login so the Pi boots straight into a user session
#   - screen-blanking + DPMS disabled
#   - a systemd --user service that launches the display on session start
#     and restarts on failure
#
# Run as the user that will own the kiosk (typically `pi`):
#     cd ~/RunaNet && bash install-kiosk.sh
#
# Re-running the script is safe; it overwrites previously installed units.
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "This installer targets Raspberry Pi OS (Linux). Refusing to run on $(uname -s)."
    exit 1
fi

if [[ $EUID -eq 0 ]]; then
    echo "Run this as your regular user, not root — it uses 'sudo' only where needed."
    exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="$USER"
USER_UID="$(id -u)"

echo "▸ Installing RunaNet kiosk for user '$USER_NAME' (repo: $REPO_DIR)"

# ── 1. Boot straight to the desktop, no password prompt ──────────────────────
echo "▸ Enabling desktop auto-login…"
sudo raspi-config nonint do_boot_behaviour B4 || {
    echo "  raspi-config not available — enable desktop autologin manually."
}

# ── 2. Stop the screen from blanking out after a few minutes ─────────────────
echo "▸ Disabling screen blanking / DPMS…"
# Bookworm ships xset for X and has wlr-randr/labwc under Wayland. The
# autostart file below sends the right commands on session start.
mkdir -p "$HOME/.config/labwc"
cat > "$HOME/.config/labwc/autostart" <<'EOF'
# Disable Wayland screen blanking and DPMS
swayidle timeout 0 true &
wlr-randr --output HDMI-A-1 --on 2>/dev/null || true
EOF

mkdir -p "$HOME/.config/wayfire.ini.d" 2>/dev/null || true

# X11 fallback (older Pi OS / Raspberry Pi 3)
mkdir -p "$HOME/.config/lxsession/LXDE-pi"
if [[ -f /etc/xdg/lxsession/LXDE-pi/autostart ]]; then
    grep -v -e '^@xset' "$HOME/.config/lxsession/LXDE-pi/autostart" 2>/dev/null > /tmp/rn-autostart || true
    {
        cat /tmp/rn-autostart 2>/dev/null || cat /etc/xdg/lxsession/LXDE-pi/autostart
        echo "@xset s off"
        echo "@xset -dpms"
        echo "@xset s noblank"
    } > "$HOME/.config/lxsession/LXDE-pi/autostart"
fi

# ── 3. Install the systemd --user service ────────────────────────────────────
echo "▸ Installing systemd user service…"
mkdir -p "$HOME/.config/systemd/user"
# Rewrite WorkingDirectory / ExecStart so the service doesn't depend on the
# repo being exactly at ~/RunaNet.
sed \
    -e "s|%h/RunaNet|$REPO_DIR|g" \
    "$REPO_DIR/runanet-display.service" \
    > "$HOME/.config/systemd/user/runanet-display.service"

systemctl --user daemon-reload
systemctl --user enable runanet-display.service

# Linger lets the user service keep running even if nobody is logged in on a
# TTY — critical for headless reboots where the kiosk must come back up alone.
echo "▸ Enabling linger so services start without an active login…"
sudo loginctl enable-linger "$USER_NAME"

# ── 4. First-time frontend build (optional but recommended) ──────────────────
if [[ ! -d "$REPO_DIR/frontend/.next/server" ]]; then
    echo "▸ Building the frontend for production (first run only)…"
    ( cd "$REPO_DIR/frontend" && npm install --silent && npm run build )
fi

echo
echo "✅ Kiosk installed."
echo
echo "   Start now  :  systemctl --user start runanet-display"
echo "   Watch logs :  journalctl --user -u runanet-display -f"
echo "   Disable    :  systemctl --user disable --now runanet-display"
echo
echo "   Reboot to verify the full boot → autologin → kiosk flow:  sudo reboot"
