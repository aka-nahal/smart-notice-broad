#!/usr/bin/env python3
"""
RunaNet Display Launcher
========================
Starts the FastAPI backend, the Next.js frontend, then opens a native
PyWebView window showing the display page.

On Raspberry Pi OS (Bookworm) the window is rendered by GTK + WebKit2,
so no Chromium installation is needed.

Usage
-----
    python launcher.py                         # fullscreen, default ports
    python launcher.py --no-fullscreen         # windowed (development)
    python launcher.py --backend-port 8001 --port 3000
    python launcher.py --build                 # run `npm build` first

Requirements
------------
    pip install pywebview
    # RPi / Linux only:
    sudo apt install python3-gi gir1.2-webkit2-4.0 libgtk-3-0
"""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
import urllib.request
from typing import Optional

# Force UTF-8 on stdout/stderr so the decorative unicode in status messages
# doesn't blow up on Windows consoles that default to cp1252. Guarded for
# older Pythons that lack `reconfigure`.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")


# ── Service launchers ─────────────────────────────────────────────────────────

def start_backend(port: int) -> subprocess.Popen:
    env = {**os.environ, "PYTHONPATH": BACKEND_DIR}
    # Load .env if present
    dotenv = os.path.join(BACKEND_DIR, ".env")
    if os.path.isfile(dotenv):
        with open(dotenv) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env.setdefault(k.strip(), v.strip())
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(port),
         "--log-level", "warning"],
        cwd=BACKEND_DIR,
        env=env,
    )


def start_frontend(port: int, backend_port: int) -> subprocess.Popen:
    env = {
        **os.environ,
        "PORT": str(port),
        "API_URL": f"http://127.0.0.1:{backend_port}",
        "HOSTNAME": "127.0.0.1",
    }
    # `.next/server` alone isn't enough — the dev server writes partial output
    # there too. BUILD_ID is the canonical "there's a real production build"
    # marker that `next start` actually requires.
    next_built = os.path.isfile(os.path.join(FRONTEND_DIR, ".next", "BUILD_ID"))
    if next_built:
        cmd = ["npm", "start", "--", "--port", str(port)]
        mode = "production"
    else:
        cmd = ["npm", "run", "dev", "--", "--port", str(port)]
        mode = "development"
    print(f"  Frontend mode: {mode}")
    # On Windows, `npm` is shipped as `npm.cmd`, which CreateProcess won't
    # resolve without the shell. shell=True is safe here because the command
    # comes from code, not user input.
    return subprocess.Popen(cmd, cwd=FRONTEND_DIR, env=env, shell=(os.name == "nt"))


def build_frontend() -> bool:
    print("Building frontend (this may take a few minutes on RPi)…")
    env = {**os.environ, "NODE_ENV": "production"}
    result = subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, env=env)
    return result.returncode == 0


# ── Browser fallback (used when pywebview isn't available) ───────────────────

def _find_browser() -> tuple[str, str] | None:
    """Return (path, flavor) for Edge or Chrome — whichever is installed.
    `flavor` is 'edge' or 'chrome' (their kiosk/app flags happen to match)."""
    candidates: list[tuple[str, str]] = []
    if os.name == "nt":
        pf = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        pfx86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
        localapp = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            (os.path.join(pfx86, r"Microsoft\Edge\Application\msedge.exe"), "edge"),
            (os.path.join(pf,    r"Microsoft\Edge\Application\msedge.exe"), "edge"),
            (os.path.join(pf,    r"Google\Chrome\Application\chrome.exe"),  "chrome"),
            (os.path.join(pfx86, r"Google\Chrome\Application\chrome.exe"),  "chrome"),
            (os.path.join(localapp, r"Google\Chrome\Application\chrome.exe"), "chrome"),
        ]
    else:
        import shutil as _shutil
        for name, flavor in [
            ("microsoft-edge-stable", "edge"), ("microsoft-edge", "edge"),
            ("google-chrome-stable", "chrome"), ("google-chrome", "chrome"),
            ("chromium-browser", "chrome"), ("chromium", "chrome"),
        ]:
            path = _shutil.which(name)
            if path:
                candidates.append((path, flavor))

    for path, flavor in candidates:
        if path and os.path.isfile(path):
            return path, flavor
    return None


def open_system_browser_app(
    url: str,
    fullscreen: bool,
    monitor: dict | None = None,
) -> subprocess.Popen | None:
    """Launch Edge/Chrome in --app or --kiosk mode so it looks like a native
    window. Used when pywebview isn't installable (e.g. Python 3.14 on Windows
    where pythonnet has no wheel). If `monitor` is given, the window opens on
    that monitor — the Chromium --window-position flag accepts the monitor's
    top-left X,Y, and kiosk/fullscreen then lands on that screen.
    Returns the Popen, or None if no browser was found."""
    found = _find_browser()
    if not found:
        return None
    path, _flavor = found
    # Isolated profile so the kiosk doesn't inherit the user's bookmarks,
    # extensions, or tabs. Lives under the repo's data dir.
    profile_dir = os.path.join(ROOT, "data", "kiosk-profile")
    os.makedirs(profile_dir, exist_ok=True)
    args = [
        path,
        f"--user-data-dir={profile_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-features=TranslateUI",
    ]
    if monitor:
        # Position + size hint the kiosk window onto the chosen monitor.
        args.append(f"--window-position={monitor['x']},{monitor['y']}")
        args.append(f"--window-size={monitor['width']},{monitor['height']}")
    args.append("--kiosk" if fullscreen else f"--app={url}")
    if fullscreen:
        args.append(url)
    mode = "kiosk" if fullscreen else "app"
    where = f" on monitor at ({monitor['x']},{monitor['y']})" if monitor else ""
    print(f"  opening {os.path.basename(path)} {mode} mode{where}...")
    return subprocess.Popen(args)


# ── Monitor selection ─────────────────────────────────────────────────────────

def _read_digit_with_timeout(valid_range: range, timeout: float) -> Optional[int]:
    """Prompt the user for a monitor index on the terminal. Returns the
    chosen 0-based index, or None on timeout / headless runs.

    Handles both platforms without blocking stdin forever:
      * Windows: polls ``msvcrt.kbhit`` so we can check Enter mid-wait.
      * POSIX:   uses ``select`` on stdin for the same effect.
    Backspace works; Enter commits; non-digit input is ignored."""
    if not sys.stdin or not sys.stdin.isatty():
        # Running under systemd / piped output - no TTY to prompt. Caller
        # should fall back to the default silently.
        return None

    deadline = time.monotonic() + timeout
    buf = ""

    def remaining() -> float:
        return max(0.0, deadline - time.monotonic())

    def redraw() -> None:
        secs = int(remaining()) + (1 if remaining() % 1 else 0)
        line = f"  Enter monitor number [{secs:>2}s]: {buf}"
        # \r + trailing spaces overwrites the previous longer line without
        # relying on ANSI escape support (Git Bash on Windows treats them
        # as literal text).
        sys.stdout.write("\r" + line.ljust(60))
        sys.stdout.flush()

    try:
        if os.name == "nt":
            import msvcrt  # type: ignore
            redraw()
            last_sec = -1
            while remaining() > 0:
                # Repaint the countdown once per second.
                cur_sec = int(remaining())
                if cur_sec != last_sec:
                    redraw()
                    last_sec = cur_sec
                if msvcrt.kbhit():
                    ch = msvcrt.getwch()
                    if ch in ("\r", "\n"):
                        if buf:
                            sys.stdout.write("\n"); sys.stdout.flush()
                            try:
                                v = int(buf) - 1
                                if v in valid_range:
                                    return v
                            except ValueError:
                                pass
                            buf = ""
                            redraw()
                            continue
                        # Enter with empty buffer just accepts the default.
                        sys.stdout.write("\n"); sys.stdout.flush()
                        return None
                    elif ch in ("\x08", "\x7f"):
                        buf = buf[:-1]
                        redraw()
                    elif ch == "\x1b":  # Esc
                        sys.stdout.write("\n"); sys.stdout.flush()
                        return None
                    elif ch.isdigit():
                        buf += ch
                        redraw()
                else:
                    time.sleep(0.05)
        else:
            import select
            redraw()
            last_sec = -1
            while remaining() > 0:
                cur_sec = int(remaining())
                if cur_sec != last_sec:
                    redraw()
                    last_sec = cur_sec
                r, _, _ = select.select([sys.stdin], [], [], 0.1)
                if r:
                    ch = sys.stdin.read(1)
                    if ch in ("\r", "\n"):
                        sys.stdout.write("\n"); sys.stdout.flush()
                        if buf:
                            try:
                                v = int(buf) - 1
                                if v in valid_range:
                                    return v
                            except ValueError:
                                pass
                        return None
                    elif ch in ("\x08", "\x7f"):
                        buf = buf[:-1]
                        redraw()
                    elif ch.isdigit():
                        buf += ch
                        redraw()
    finally:
        sys.stdout.write("\n"); sys.stdout.flush()

    return None


def pick_monitor(timeout: float = 5.0) -> Optional[dict]:
    """Prompt on the terminal for which monitor to use. Auto-picks the primary
    monitor after ``timeout`` seconds if the user doesn't respond (or if
    there's no TTY, e.g. running under systemd). Returns a dict with ``x``,
    ``y``, ``width``, ``height`` for the chosen monitor, or None if screen
    enumeration isn't available."""
    try:
        from screeninfo import get_monitors  # type: ignore
    except Exception:
        print("  screeninfo not installed - using default monitor.")
        return None

    try:
        monitors = get_monitors()
    except Exception as e:
        print(f"  monitor enumeration failed ({e}) - using default.")
        return None

    if not monitors:
        return None

    default_idx = next((i for i, m in enumerate(monitors) if getattr(m, "is_primary", False)), 0)

    print("")
    print("  Available displays:")
    for i, m in enumerate(monitors):
        is_default = i == default_idx
        tag = "  [default]" if is_default else ""
        primary = "  (primary)" if getattr(m, "is_primary", False) else ""
        print(f"    {i + 1}. {m.width}x{m.height} @ ({m.x},{m.y}){primary}{tag}")
    print("")

    picked = _read_digit_with_timeout(range(len(monitors)), timeout)
    idx = picked if picked is not None else default_idx
    if picked is None:
        print(f"  -> auto-selected monitor {idx + 1} (default)")
    else:
        print(f"  -> monitor {idx + 1}")

    m = monitors[idx]
    return {"x": m.x, "y": m.y, "width": m.width, "height": m.height}


# ── Readiness polling ─────────────────────────────────────────────────────────

def wait_for(url: str, timeout: int = 120, label: str = "") -> bool:
    deadline = time.time() + timeout
    attempts = 0
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=3)
            return True
        except Exception:
            time.sleep(1.5)
            attempts += 1
            if attempts % 8 == 0 and label:
                elapsed = int(time.time() - (deadline - timeout))
                print(f"  still waiting for {label}… ({elapsed}s)")
    return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="RunaNet display launcher — starts services and opens a native window"
    )
    parser.add_argument("--port",         type=int, default=3000,  help="Frontend port (default 3000)")
    parser.add_argument("--backend-port", type=int, default=8000,  help="Backend port (default 8000)")
    parser.add_argument("--no-fullscreen", action="store_true",    help="Open in a resizable window instead of fullscreen")
    parser.add_argument("--width",        type=int, default=1920,  help="Window width when not fullscreen")
    parser.add_argument("--height",       type=int, default=1080,  help="Window height when not fullscreen")
    parser.add_argument("--build",        action="store_true",     help="Run npm build before starting")
    parser.add_argument("--debug",        action="store_true",     help="Enable webview devtools and verbose output")
    parser.add_argument("--no-presence",  action="store_true",     help="Disable camera-based lock-screen presence detection")
    parser.add_argument("--presence-grace", type=float, default=20.0, help="Seconds to stay unlocked after a viewer leaves the camera (default 20)")
    parser.add_argument("--monitor-timeout", type=float, default=5.0, help="Seconds before the monitor picker auto-selects (default 5)")
    args = parser.parse_args()

    procs: list[subprocess.Popen] = []

    def cleanup(*_: object) -> None:
        print("\nShutting down RunaNet...")
        for p in procs:
            try:
                if os.name == "nt":
                    # Frontend runs under a cmd.exe shell (needed to resolve
                    # npm.cmd), so terminating the shell orphans node.exe.
                    # taskkill /T walks the whole child tree.
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(p.pid)],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    )
                else:
                    p.terminate()
                    p.wait(timeout=5)
            except Exception:
                try: p.kill()
                except Exception: pass
        sys.exit(0)

    signal.signal(signal.SIGINT,  cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # ── Optional build step ───────────────────────────────────────────────────
    if args.build:
        if not build_frontend():
            print("ERROR: npm build failed.")
            sys.exit(1)

    # ── Start services ────────────────────────────────────────────────────────
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

    # ── Monitor selection (multi-display only) ────────────────────────────────
    # Always runs when multiple monitors are present, even in windowed mode -
    # the dialog is how we let you choose WHICH screen the window opens on.
    # On single-monitor systems pick_monitor returns None without a dialog.
    monitor = pick_monitor(timeout=args.monitor_timeout)
    if monitor:
        print(f"  using monitor at ({monitor['x']},{monitor['y']}) "
              f"{monitor['width']}x{monitor['height']}")

    # ── Presence detector (lock-screen driver) ────────────────────────────────
    detector = None
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

    # Extend cleanup to stop the detector
    _orig_cleanup = cleanup
    def cleanup_all(*a: object) -> None:  # type: ignore[misc]
        if detector is not None:
            try: detector.stop()
            except Exception: pass
        _orig_cleanup(*a)

    signal.signal(signal.SIGINT,  cleanup_all)
    signal.signal(signal.SIGTERM, cleanup_all)
    cleanup = cleanup_all  # noqa: F811

    # ── Open native window ────────────────────────────────────────────────────
    print("Opening display window...")
    try:
        import webview  # type: ignore
    except ImportError:
        print("pywebview not available - falling back to system browser in app mode.")
        browser_proc = open_system_browser_app(
            url=f"http://127.0.0.1:{args.port}/display",
            fullscreen=not args.no_fullscreen,
            monitor=monitor,
        )
        if browser_proc is None:
            print("  no Edge/Chrome found. Open this URL in any browser instead:")
            print(f"    http://127.0.0.1:{args.port}/display")

        # Stay alive and supervise the backend/frontend. On Windows,
        # `msedge.exe --app=...` exits immediately after handing the URL to an
        # existing Edge process - so browser_proc.poll() is not a reliable
        # signal that the user closed the window. We just run until Ctrl+C on
        # Windows. On Linux/macOS the browser we launched IS the window.
        print("Services are running. Press Ctrl+C to stop (or close the window on Linux/macOS).")
        watch_browser = browser_proc is not None and os.name != "nt"
        crash_history: list[list[float]] = [[], []]  # recent start timestamps per proc
        try:
            while True:
                time.sleep(2)
                if watch_browser and browser_proc.poll() is not None:  # type: ignore[union-attr]
                    print("Browser window closed.")
                    break
                for i, p in enumerate(procs):
                    if p.poll() is None:
                        continue
                    now = time.time()
                    crash_history[i] = [t for t in crash_history[i] if now - t < 30] + [now]
                    if len(crash_history[i]) >= 3:
                        label = "backend" if i == 0 else "frontend"
                        print(f"{label} crashed 3x in 30s - giving up. Check the logs above.")
                        cleanup_all()
                        return
                    print(f"Service {i} crashed (exit {p.returncode}), restarting...")
                    procs[i] = start_backend(args.backend_port) if i == 0 else start_frontend(args.port, args.backend_port)
        except KeyboardInterrupt:
            pass
        cleanup_all()
        return

    want_fullscreen = not args.no_fullscreen

    if monitor:
        # Place the window on the chosen monitor first; we'll flip to fullscreen
        # after load so the native fullscreen lands on the right screen.
        win_x, win_y = monitor["x"], monitor["y"]
        win_w, win_h = monitor["width"], monitor["height"]
        initial_fullscreen = False
    else:
        win_x = win_y = None
        win_w, win_h = args.width, args.height
        initial_fullscreen = want_fullscreen

    window = webview.create_window(
        title="RunaNet",
        url=f"http://127.0.0.1:{args.port}/display",
        x=win_x,
        y=win_y,
        width=win_w,
        height=win_h,
        fullscreen=initial_fullscreen,
        frameless=want_fullscreen,
        easy_drag=False,
        text_select=False,
        zoomable=False,
        confirm_close=False,
        background_color="#000000",
    )

    # Shut down services when the window is closed
    window.events.closed += cleanup

    # Optional: inject a context menu blocker so right-click is disabled
    def on_loaded() -> None:
        window.evaluate_js(
            "document.addEventListener('contextmenu', e => e.preventDefault());"
        )
        # If we placed the window on a specific monitor, go fullscreen now —
        # the native toggle fullscreens on whichever monitor holds the window.
        if monitor and want_fullscreen:
            try:
                window.toggle_fullscreen()
            except Exception as e:
                print(f"  fullscreen toggle failed: {e}")

    window.events.loaded += on_loaded

    webview.start(debug=args.debug)
    cleanup()


if __name__ == "__main__":
    main()
