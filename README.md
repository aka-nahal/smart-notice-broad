# RunaNet

Digital notice board platform for Raspberry Pi 5 / Debian Trixie:

- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Display:** native pywebview (GTK + WebKit2) kiosk window
- **Optional AI:** Gemini notice drafting

---

## Quickstart

PyGObject (`gi`) and WebKit2GTK come from the OS package manager — pip
can't reliably build them. `start.sh` creates the venv with
`--system-site-packages` so it picks them up.

System packages (one-time):

**Raspberry Pi 5 / Debian Trixie / Ubuntu**
```bash
sudo apt install -y python3-venv python3-gi gir1.2-webkit2-4.1 \
                    libgtk-3-0 nodejs npm network-manager
# Optional: camera-based lock screen
sudo apt install -y python3-picamera2 rpicam-apps
```

**Arch / CachyOS / Manjaro**
```bash
sudo pacman -S --needed python python-gobject webkit2gtk-4.1 \
                       gtk3 nodejs npm networkmanager
```

**Fedora**
```bash
sudo dnf install python3 python3-gobject webkit2gtk4.1 gtk3 \
                 nodejs npm NetworkManager
```

Run it:

```bash
./start.sh                   # fullscreen kiosk
./start.sh --no-fullscreen   # windowed (development)
./start.sh --build           # rebuild frontend first
./start.sh --no-presence     # disable camera lock screen
./start.sh --no-hotspot      # don't fall back to a Wi-Fi hotspot
```

`start.sh` creates `backend/.venv`, installs Python + Node deps, and hands
off to `launcher.py`. Backend listens on `:8000`, frontend on `:3000`,
both bound to `0.0.0.0` so any device on the LAN can reach them.

### Network fallback (Pi only)

The launcher detects whether it's running on a Raspberry Pi by reading
`/proc/device-tree/model`. On a Pi with no network connectivity at
startup, NetworkManager brings up a Wi-Fi hotspot:

- **SSID:** `RunaNet`
- **Password:** `0987654321`

Connect a phone/laptop to that SSID and open `http://10.42.0.1:3000/admin`
(NetworkManager's default shared-mode subnet) to manage the board.

On a laptop/desktop the hotspot logic is skipped entirely — the launcher
just runs on whatever network the machine is already on.

---

## URLs

Replace `<host>` with the Pi's LAN IP (printed by the launcher on start),
or `10.42.0.1` when on the hotspot.

- Display: `http://<host>:3000/` (also `/display`)
- Admin:   `http://<host>:3000/admin`
- Builder: `http://<host>:3000/admin/builder`
- API:     `http://<host>:8000`

---

## Builder Workflow

1. Open `/admin/builder`
2. Add tiles from the left palette
3. Drag tiles in the grid canvas
4. Edit tile properties in the right inspector (type, position, size, z-index, notice link)
5. Click **Publish**
6. Open `/` to view the published board

---

## API Overview

Base URL: `http://<host>:8000/api`

### Display
- `GET /display/bundle`

### Notices
- `GET /notices`
- `POST /notices`
- `GET /notices/{notice_id}`
- `PATCH /notices/{notice_id}`
- `DELETE /notices/{notice_id}`

### Layouts / tiles
- `GET /layouts`
- `POST /layouts`
- `GET /layouts/{layout_id}`
- `POST /layouts/{layout_id}/versions/{version_id}/tiles`
- `PATCH /layouts/{layout_id}/versions/{version_id}/tiles/{tile_id}`
- `DELETE /layouts/{layout_id}/versions/{version_id}/tiles/{tile_id}`
- `POST /layouts/{layout_id}/versions/{version_id}/publish`

### AI
- `POST /ai/draft-notice`

---

## Environment Variables

### Frontend
- `API_URL` — backend base URL used by server-side fetches (default `http://127.0.0.1:8000`)

### Backend

Copy `backend/.env.example` to `backend/.env` and set:

- `GEMINI_API_KEY` — required only for `/ai/draft-notice`
- `OPENWEATHER_API_KEY` — required only for weather tiles
- `CORS_ORIGINS` — comma-separated allowed origins

---

## Repo Structure

```text
backend/
  app/
    routers/      # notices, layouts, display, ai
    models/       # SQLAlchemy models
    schemas/      # Pydantic schemas
    services/     # display bundle + ai service
  .venv/          # auto-created by start.sh
frontend/
  app/            # Next.js app routes
  components/     # display + builder UI components
  lib/            # shared frontend types + grid math
launcher.py       # service supervisor + kiosk window
presence_detector.py  # camera → /api/presence (lock screen driver)
start.sh          # bootstrap (venv + npm install) → launcher.py
```

---

## Troubleshooting

### Display says it cannot load bundle
- Confirm backend is running: `curl http://127.0.0.1:8000/health`
- Check `http://127.0.0.1:8000/api/display/bundle` directly

### pywebview window doesn't open
Make sure the GTK + WebKit2 system packages are installed (see Quickstart).
On a headless boot you'll need a display server (Wayland/X11) before
`launcher.py` can open the kiosk.

### Hotspot doesn't come up
- Confirm `nmcli device` shows a `wifi` interface
- Confirm NetworkManager is managing it (not `wpa_supplicant` standalone)
- `nmcli connection show RunaNet-Hotspot` shows the saved profile
