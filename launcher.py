#!/usr/bin/env python3
"""RunaNet display launcher — Raspberry Pi 5 / Debian Trixie.

Starts the FastAPI backend and Next.js frontend bound to 0.0.0.0 so any
device on the LAN can reach them, then opens a native pywebview window
(GTK + WebKit2) showing the display page.

On a Raspberry Pi with no network connectivity at startup, NetworkManager
is asked to bring up a Wi-Fi hotspot named ``RunaNet`` (password
``0987654321``) so phones/laptops can still reach the admin UI. On a
laptop/desktop the hotspot logic is skipped — the launcher just runs on
whatever network you're already on.

Usage:
    python launcher.py                 # fullscreen, default ports
    python launcher.py --no-fullscreen # windowed (development)
    python launcher.py --build         # run `npm run build` first
"""

from __future__ import annotations

import argparse
import os
import platform
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
VENV_PY = BACKEND_DIR / ".venv" / "bin" / "python"

HOTSPOT_SSID = "RunaNet"
HOTSPOT_PASSWORD = "0987654321"
HOTSPOT_CON_NAME = "RunaNet-Hotspot"


# ── Platform detection ───────────────────────────────────────────────────────

def detect_platform() -> tuple[str, str]:
    """Return ``(kind, model)`` where ``kind`` is one of:
      * ``"rpi"``     — Raspberry Pi (any model)
      * ``"laptop"``  — desktop/laptop (any non-Pi machine)
    and ``model`` is a human-readable string for logging.

    The Pi check reads ``/proc/device-tree/model``, which on every Pi
    contains a string like ``"Raspberry Pi 5 Model B Rev 1.0"`` and does
    not exist on x86 systems."""
    arch = platform.machine() or "unknown"
    dt_model = Path("/proc/device-tree/model")
    if dt_model.is_file():
        try:
            # The device-tree file is NUL-terminated; strip it.
            model = dt_model.read_text(errors="replace").strip("\x00 \n")
            if "raspberry pi" in model.lower():
                return "rpi", f"{model} ({arch})"
        except OSError:
            pass
    return "laptop", f"{platform.system()} {platform.release()} ({arch})"


# ── Chromium kiosk (preferred when available) ────────────────────────────────

_CHROMIUM_CANDIDATES = (
    "chromium", "chromium-browser",
    "google-chrome-stable", "google-chrome",
    "microsoft-edge-stable", "microsoft-edge",
    "brave-browser", "brave",
)


def find_chromium() -> Optional[str]:
    """Path to a Chromium-family browser, or None. Chromium handles
    HTML5 autoplay/loop reliably out of the box, where WebKit2GTK does not —
    so we prefer it whenever it's installed."""
    import shutil
    for name in _CHROMIUM_CANDIDATES:
        path = shutil.which(name)
        if path:
            return path
    return None


def launch_chromium_kiosk(
    binary: str,
    url: str,
    *,
    fullscreen: bool,
    width: int,
    height: int,
) -> subprocess.Popen:
    """Open Chromium in kiosk/app mode pointing at ``url``. Uses an isolated
    profile under ``data/kiosk-profile`` so the kiosk doesn't inherit the
    user's regular browser bookmarks/extensions."""
    profile_dir = ROOT / "data" / "kiosk-profile"
    profile_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        binary,
        f"--user-data-dir={profile_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        # The two flags that actually matter for our case: allow muted (and
        # unmuted) autoplay without a user gesture, and skip Translate UI.
        "--autoplay-policy=no-user-gesture-required",
        "--disable-features=TranslateUI,Translate",
        # Kiosk niceties — no swipe-back, no pinch-zoom, no session-restore
        # banner after a crash, no infobars.
        "--disable-pinch",
        "--overscroll-history-navigation=0",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--noerrdialogs",
        # Force a clean window position; some WMs otherwise restore from
        # the last session.
        "--window-position=0,0",
        f"--window-size={width},{height}",
    ]
    if fullscreen:
        cmd.append("--kiosk")
        cmd.append(url)
    else:
        cmd.append(f"--app={url}")
    return subprocess.Popen(cmd, start_new_session=True)


# ── WebKit2GTK autoplay policy ───────────────────────────────────────────────

def _enable_webkit_autoplay() -> None:
    """Drop WebKit2GTK's autoplay block so kiosk videos start without a
    user gesture. WebKit applies the policy in two layers:

      1. ``WebKitSettings.media-playback-requires-user-gesture`` (legacy,
         pre-2.30). Often already False on modern builds.
      2. ``WebKitWebsitePolicies.autoplay`` (per-site policy, 2.30+). This
         is what's actually enforced on current GTK builds — flipping only
         (1) leaves play() rejecting with ``NotAllowedError``.

    Both must be set or muted autoplay still gets blocked. We hook into
    pywebview's GTK BrowserView constructor since pywebview itself exposes
    no API to reach either knob.
    """
    try:
        import webview.platforms.gtk as gtk_platform  # type: ignore
    except Exception as e:
        print(f"  webkit autoplay tweak skipped: {e}")
        return

    if getattr(gtk_platform.BrowserView, "_runanet_patched", False):
        return

    # Match whatever WebKit2 ABI pywebview imported so our enums and types
    # come from the same gi namespace it's using.
    try:
        import gi  # type: ignore
        for ver in ("4.1", "4.0"):
            try:
                gi.require_version("WebKit2", ver)
                break
            except (ValueError, AttributeError):
                continue
        from gi.repository import WebKit2  # type: ignore
    except Exception as e:
        print(f"  webkit autoplay tweak skipped: {e}")
        return

    original_init = gtk_platform.BrowserView.__init__

    def patched_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        original_init(self, *args, **kwargs)
        # Layer 1: the legacy WebKitSettings flag (still respected on some
        # builds and harmless when superseded by WebsitePolicies).
        try:
            settings = self.webview.get_settings()
            settings.set_property("media-playback-requires-user-gesture", False)
            for prop in ("enable-mediasource", "enable-smooth-scrolling"):
                try: settings.set_property(prop, True)
                except Exception: pass
        except Exception as e:
            print(f"  webkit settings tweak: {e}")

        # Layer 2: WebsitePolicies (per-navigation autoplay). This is what
        # WebKit2GTK ≥ 2.30 actually consults; without it play() rejects
        # with NotAllowedError despite the legacy setting above.
        # WebView itself doesn't expose a setter, but every navigation
        # passes through `decide-policy` where we can substitute the
        # decision with one that carries our policies.
        def on_decide_policy(_view, decision, _dtype):
            try:
                policies = WebKit2.WebsitePolicies(autoplay=WebKit2.AutoplayPolicy.ALLOW)
                decision.use_with_policies(policies)
                return True
            except Exception:
                return False

        try:
            self.webview.connect("decide-policy", on_decide_policy)
        except Exception as e:
            print(f"  webkit decide-policy hook: {e}")

    gtk_platform.BrowserView.__init__ = patched_init  # type: ignore[method-assign]
    gtk_platform.BrowserView._runanet_patched = True  # type: ignore[attr-defined]


# ── GTK / WebKit dependency hints ────────────────────────────────────────────

def _print_gtk_install_hint() -> None:
    """Best-effort hint for the GTK/WebKit system packages pywebview needs.
    PyGObject can't be pip-installed reliably, so we direct the user to the
    distro package manager instead of pip."""
    distro = ""
    os_release = Path("/etc/os-release")
    if os_release.is_file():
        for line in os_release.read_text(errors="replace").splitlines():
            if line.startswith("ID="):
                distro = line.partition("=")[2].strip().strip('"').lower()
                break

    print("ERROR: PyGObject (`gi`) not available — pywebview can't open a window.")
    if distro in {"arch", "cachyos", "manjaro", "endeavouros"}:
        print("  Install: sudo pacman -S python-gobject webkit2gtk-4.1")
    elif distro in {"debian", "raspbian", "ubuntu", "linuxmint", "pop"}:
        print("  Install: sudo apt install python3-gi gir1.2-webkit2-4.1 libgtk-3-0")
    elif distro in {"fedora", "rhel", "centos"}:
        print("  Install: sudo dnf install python3-gobject webkit2gtk4.1 gtk3")
    else:
        print("  Install your distro's PyGObject + WebKit2GTK 4.1 packages.")
    print("  Then re-run ./start.sh — the venv is configured to see system packages.")


# ── Networking ────────────────────────────────────────────────────────────────

def lan_ip() -> str:
    """Best-effort LAN IPv4 of this host. Falls back to 127.0.0.1."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("1.1.1.1", 80))
            return s.getsockname()[0]
    except OSError:
        pass
    try:
        return socket.gethostbyname(socket.gethostname())
    except OSError:
        return "127.0.0.1"


def has_connectivity(timeout: float = 3.0) -> bool:
    """True if we can open a TCP connection to a public host."""
    for host, port in [("1.1.1.1", 53), ("8.8.8.8", 53)]:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def _ufw_enabled() -> bool:
    """True if ufw is installed and its config marks it enabled. Reads
    ``/etc/ufw/ufw.conf`` directly — `ufw status` requires root, so we
    can't ask it from a non-privileged launcher."""
    cfg = Path("/etc/ufw/ufw.conf")
    if not cfg.is_file():
        return False
    try:
        for line in cfg.read_text(errors="replace").splitlines():
            line = line.strip()
            if line.startswith("ENABLED="):
                return line.partition("=")[2].strip().strip('"').lower() in ("yes", "true", "on", "1")
    except OSError:
        pass
    return False


def ensure_firewall_open(port: int) -> None:
    """Make sure inbound TCP ``port`` is allowed through ufw, so LAN
    devices can actually reach the admin/display UI despite the 0.0.0.0
    bind. Idempotent — ufw silently no-ops on duplicate rules. When we
    lack the privileges to add the rule, prints the exact command the
    user needs to run.

    Only the frontend port is opened; the backend stays internal because
    Next.js proxies API calls to it server-side.

    nftables/iptables aren't auto-touched here — their rule schemas vary
    too much to safely edit without clobbering user customisations."""
    if not _have("ufw") or not _ufw_enabled():
        return
    try:
        rc = subprocess.run(
            ["ufw", "allow", f"{port}/tcp"],
            capture_output=True, text=True, timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"  ufw check skipped: {e}")
        return
    if rc.returncode == 0:
        print(f"  ufw: ensured inbound :{port}/tcp is allowed for LAN access")
        return
    print(f"  WARNING: ufw is active and blocking inbound :{port}/tcp.")
    print(f"  LAN devices won't reach the admin UI until you run:")
    print(f"    sudo ufw allow {port}/tcp")


def ensure_hotspot() -> bool:
    """Bring up a NetworkManager Wi-Fi hotspot if no network is reachable.
    Returns True if a hotspot is active (newly created or already running)."""
    if not _have("nmcli"):
        print("  nmcli not available — skipping hotspot setup.")
        return False

    if has_connectivity():
        return False

    wifi_dev = _wifi_device()
    if not wifi_dev:
        print("  no Wi-Fi device found — cannot start hotspot.")
        return False

    print(f"  no connectivity — starting Wi-Fi hotspot '{HOTSPOT_SSID}' on {wifi_dev}…")
    # `nmcli device wifi hotspot` creates a fresh ad-hoc-style AP using
    # NetworkManager's built-in shared mode (handles dnsmasq + NAT for us).
    rc = subprocess.run(
        ["nmcli", "device", "wifi", "hotspot",
         "ifname", wifi_dev,
         "con-name", HOTSPOT_CON_NAME,
         "ssid", HOTSPOT_SSID,
         "password", HOTSPOT_PASSWORD],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    if rc.returncode != 0:
        print(f"  hotspot start failed: {rc.stdout.strip()}")
        return False
    print(f"  hotspot up: SSID={HOTSPOT_SSID} password={HOTSPOT_PASSWORD}")
    return True


def _have(cmd: str) -> bool:
    import shutil
    return shutil.which(cmd) is not None


# ── Port reclaim ─────────────────────────────────────────────────────────────

# Substrings we recognise as "ours" in a process cmdline. We only kill
# leftover holders that match one of these — never an unrelated service
# that happens to share the port.
_OWN_CMDLINE_MARKERS = (
    "uvicorn", "app.main:app",
    "next-server", "next dev", "next start",
    "launcher.py",
)


def _port_holders(port: int) -> list[int]:
    """PIDs listening on ``port``. Empty list on parse failure."""
    if not _have("ss"):
        return []
    try:
        out = subprocess.check_output(
            ["ss", "-tlnpH", f"sport = :{port}"],
            text=True, stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    pids: list[int] = []
    for line in out.splitlines():
        # ss prints `... users:(("name",pid=12345,fd=N), ...)` — pull every
        # `pid=NNNN` token, since a port can have multiple listeners.
        for token in line.split("pid=")[1:]:
            digits = token.split(",")[0].split(")")[0].strip()
            if digits.isdigit():
                pids.append(int(digits))
    return pids


def _is_our_process(pid: int) -> bool:
    """True if ``pid``'s cmdline looks like a previous RunaNet child."""
    try:
        cmdline = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\x00", b" ").decode(errors="replace")
    except OSError:
        return False
    return any(marker in cmdline for marker in _OWN_CMDLINE_MARKERS)


def reclaim_port(port: int, label: str) -> None:
    """If a previous RunaNet run left a process listening on ``port``,
    SIGTERM (then SIGKILL) it. Refuses to touch foreign processes — those
    print a clear error and abort, so we don't accidentally nuke an
    unrelated service the user is running."""
    pids = _port_holders(port)
    if not pids:
        return

    own = [p for p in pids if _is_our_process(p)]
    foreign = [p for p in pids if p not in own]

    if foreign:
        print(f"ERROR: port {port} ({label}) held by non-RunaNet process(es): {foreign}")
        print(f"  Stop them first, e.g.:  ss -tlnp 'sport = :{port}'")
        sys.exit(1)

    print(f"  reclaiming :{port} from stale {label} pid(s) {own}…")
    for pid in own:
        try: os.kill(pid, signal.SIGTERM)
        except ProcessLookupError: pass

    deadline = time.time() + 3
    while time.time() < deadline:
        if not any(_pid_alive(p) for p in own):
            return
        time.sleep(0.1)

    for pid in own:
        if _pid_alive(pid):
            try: os.kill(pid, signal.SIGKILL)
            except ProcessLookupError: pass


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _wifi_device() -> Optional[str]:
    """First Wi-Fi interface name nmcli knows about, or None."""
    try:
        out = subprocess.check_output(
            ["nmcli", "-t", "-f", "DEVICE,TYPE", "device"], text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    for line in out.splitlines():
        dev, _, typ = line.partition(":")
        if typ == "wifi":
            return dev
    return None


# ── Service launchers ─────────────────────────────────────────────────────────

def _python() -> str:
    """Use the backend venv interpreter when present; fall back to current."""
    return str(VENV_PY) if VENV_PY.is_file() else sys.executable


def _load_dotenv(env: dict[str, str]) -> None:
    dotenv = BACKEND_DIR / ".env"
    if not dotenv.is_file():
        return
    for line in dotenv.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env.setdefault(k.strip(), v.strip())


def start_backend(port: int) -> subprocess.Popen:
    env = {**os.environ, "PYTHONPATH": str(BACKEND_DIR)}
    _load_dotenv(env)
    return subprocess.Popen(
        [_python(), "-m", "uvicorn", "app.main:app",
         "--host", "0.0.0.0", "--port", str(port),
         "--log-level", "warning"],
        cwd=BACKEND_DIR,
        env=env,
        # Own process group so cleanup() can SIGTERM the whole tree.
        start_new_session=True,
    )


def start_frontend(port: int, backend_port: int) -> subprocess.Popen:
    env = {
        **os.environ,
        "PORT": str(port),
        "API_URL": f"http://127.0.0.1:{backend_port}",
        "HOSTNAME": "0.0.0.0",
    }
    next_built = (FRONTEND_DIR / ".next" / "BUILD_ID").is_file()
    if next_built:
        cmd = ["npm", "start", "--", "--port", str(port), "--hostname", "0.0.0.0"]
        mode = "production"
    else:
        cmd = ["npm", "run", "dev", "--", "--port", str(port), "--hostname", "0.0.0.0"]
        mode = "development"
    print(f"  Frontend mode: {mode}")
    return subprocess.Popen(
        cmd, cwd=FRONTEND_DIR, env=env,
        # npm spawns next-server as a grandchild and doesn't always forward
        # signals; the new session lets cleanup() reach the whole tree.
        start_new_session=True,
    )


def build_frontend() -> bool:
    print("Building frontend (this may take a few minutes on RPi)…")
    env = {**os.environ, "NODE_ENV": "production"}
    return subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, env=env).returncode == 0


# ── Readiness polling ─────────────────────────────────────────────────────────

def wait_for(url: str, timeout: int = 120, label: str = "") -> bool:
    deadline = time.time() + timeout
    attempts = 0
    last_exc: Optional[BaseException] = None
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=3)
            return True
        except urllib.error.HTTPError:
            # Any HTTP response (3xx/4xx/5xx) means the server is up.
            return True
        except Exception as e:
            last_exc = e
            time.sleep(1.5)
            attempts += 1
            if attempts % 8 == 0 and label:
                elapsed = int(time.time() - (deadline - timeout))
                print(f"  still waiting for {label}… ({elapsed}s)")

    print(f"  readiness probe failed: {_diag(url, last_exc)}")
    return False


def _diag(url: str, exc: Optional[BaseException]) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    err = f"{type(exc).__name__}: {exc}" if exc else "no exception"
    try:
        with socket.create_connection((host, port), timeout=3):
            tcp = "TCP open"
    except Exception as e:
        tcp = f"TCP failed ({type(e).__name__}: {e})"
    return f"url={url} last={err} tcp={tcp}"


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="RunaNet display launcher (Raspberry Pi 5 / Trixie)"
    )
    parser.add_argument("--port",         type=int, default=3000, help="Frontend port (default 3000)")
    parser.add_argument("--backend-port", type=int, default=8000, help="Backend port (default 8000)")
    parser.add_argument("--no-fullscreen", action="store_true",   help="Open in a resizable window")
    parser.add_argument("--width",        type=int, default=1920, help="Window width when not fullscreen")
    parser.add_argument("--height",       type=int, default=1080, help="Window height when not fullscreen")
    parser.add_argument("--build",        action="store_true",    help="Run npm build before starting")
    parser.add_argument("--debug",        action="store_true",    help="Enable webview devtools")
    parser.add_argument("--no-presence",  action="store_true",    help="Disable camera-based lock screen")
    parser.add_argument("--presence-grace", type=float, default=20.0,
                        help="Seconds to stay unlocked after a viewer leaves the camera")
    parser.add_argument("--no-hotspot",   action="store_true",    help="Don't fall back to a Wi-Fi hotspot (Pi only)")
    parser.add_argument("--video-debug",  action="store_true",    help="Overlay a small playback HUD on each video tile")
    args = parser.parse_args()

    procs: list[subprocess.Popen] = []
    detector = None

    def cleanup(*_: object) -> None:
        print("\nShutting down RunaNet…")
        for p in procs:
            if p.poll() is not None:
                continue
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                try: p.terminate()
                except Exception: pass

        deadline = time.time() + 5
        while time.time() < deadline and any(p.poll() is None for p in procs):
            time.sleep(0.1)
        for p in procs:
            if p.poll() is None:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                except Exception:
                    pass
        if detector is not None:
            try: detector.stop()
            except Exception: pass
        sys.exit(0)

    signal.signal(signal.SIGINT,  cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    kind, model = detect_platform()
    print(f"Platform: {model} → {kind}")

    # ── Network ───────────────────────────────────────────────────────────────
    # Only Pis fall back to a hotspot. Laptops just run on whatever network
    # they're already on — turning a dev machine's Wi-Fi into an AP would
    # kick the developer off their own internet.
    if kind == "rpi" and not args.no_hotspot:
        ensure_hotspot()

    # Punch a hole in ufw for the frontend port. Does nothing if ufw isn't
    # installed/enabled. Run on every host kind because devs hitting the
    # admin UI from a phone on a laptop hit the same wall as the Pi.
    ensure_firewall_open(args.port)

    # ── Optional build ────────────────────────────────────────────────────────
    if args.build and not build_frontend():
        print("ERROR: npm build failed.")
        sys.exit(1)

    # ── Services ──────────────────────────────────────────────────────────────
    # Reclaim ports first so a previous crashed/aborted run can't block the
    # new one with EADDRINUSE. Only kills leftover RunaNet children — see
    # _OWN_CMDLINE_MARKERS — never an unrelated listener.
    reclaim_port(args.backend_port, "backend")
    reclaim_port(args.port, "frontend")

    print("Starting backend…")
    procs.append(start_backend(args.backend_port))

    print("Starting frontend…")
    procs.append(start_frontend(args.port, args.backend_port))

    print(f"Waiting for backend (:{args.backend_port})…")
    if not wait_for(f"http://127.0.0.1:{args.backend_port}/health", label="backend"):
        print("ERROR: Backend did not become ready in time.")
        cleanup()

    print(f"Waiting for frontend (:{args.port})…")
    if not wait_for(f"http://127.0.0.1:{args.port}", label="frontend"):
        print("ERROR: Frontend did not become ready in time.")
        cleanup()

    ip = lan_ip()
    print("")
    print("RunaNet is up:")
    print(f"  Display: http://{ip}:{args.port}/display")
    print(f"  Admin:   http://{ip}:{args.port}/admin")
    print(f"  API:     http://{ip}:{args.backend_port}")
    print("")

    # ── Presence detector ─────────────────────────────────────────────────────
    if not args.no_presence:
        try:
            from presence_detector import PresenceDetector
            detector = PresenceDetector(
                backend_port=args.backend_port,
                grace_seconds=args.presence_grace,
            )
            detector.start()
        except Exception as e:
            print(f"  presence detector not started: {e}")

    # ── Display window ────────────────────────────────────────────────────────
    want_fullscreen = not args.no_fullscreen
    display_url = f"http://127.0.0.1:{args.port}/display"
    if args.video_debug:
        display_url += "?vdebug"

    chromium = find_chromium()
    if chromium:
        print(f"Opening Chromium kiosk ({os.path.basename(chromium)})…")
        browser_proc = launch_chromium_kiosk(
            chromium, display_url,
            fullscreen=want_fullscreen,
            width=args.width, height=args.height,
        )
        procs.append(browser_proc)
        # Supervise: when the browser window closes (or backend/frontend
        # die), tear everything down.
        try:
            while browser_proc.poll() is None:
                time.sleep(0.5)
                if any(p.poll() is not None for p in procs[:2]):
                    print("backend or frontend exited — shutting down.")
                    break
        except KeyboardInterrupt:
            pass
        cleanup()
        return

    # ── Fallback: pywebview/WebKit2GTK ────────────────────────────────────────
    print("No Chromium found — falling back to pywebview.")
    try:
        import webview  # type: ignore
    except ImportError:
        print("ERROR: pywebview not installed. Run start.sh to bootstrap.")
        cleanup()
        return

    try:
        import gi  # type: ignore  # noqa: F401
    except ImportError:
        _print_gtk_install_hint()
        cleanup()
        return

    _enable_webkit_autoplay()

    window = webview.create_window(
        title="RunaNet",
        url=display_url,
        width=args.width,
        height=args.height,
        fullscreen=want_fullscreen,
        frameless=want_fullscreen,
        easy_drag=False,
        text_select=False,
        zoomable=False,
        confirm_close=False,
        background_color="#000000",
    )

    window.events.closed += cleanup

    def on_loaded() -> None:
        # Disable right-click in the kiosk view.
        window.evaluate_js(
            "document.addEventListener('contextmenu', e => e.preventDefault());"
        )

    window.events.loaded += on_loaded

    # private_mode=False + a persistent storage_path keeps localStorage,
    # cookies, and IndexedDB across restarts. pywebview defaults to private
    # mode, where WebKit refuses localStorage and the Next.js admin UI
    # crashes with "Can't find variable: localStorage".
    storage_path = ROOT / "data" / "webview-storage"
    storage_path.mkdir(parents=True, exist_ok=True)
    webview.start(
        gui="gtk",
        debug=args.debug,
        private_mode=False,
        storage_path=str(storage_path),
    )
    cleanup()


if __name__ == "__main__":
    main()
