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
    next_built = os.path.isdir(os.path.join(FRONTEND_DIR, ".next", "server"))
    if next_built:
        cmd = ["npm", "start", "--", "--port", str(port)]
        mode = "production"
    else:
        cmd = ["npm", "run", "dev", "--", "--port", str(port)]
        mode = "development"
    print(f"  Frontend mode: {mode}")
    return subprocess.Popen(cmd, cwd=FRONTEND_DIR, env=env)


def build_frontend() -> bool:
    print("Building frontend (this may take a few minutes on RPi)…")
    env = {**os.environ, "NODE_ENV": "production"}
    result = subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, env=env)
    return result.returncode == 0


# ── Monitor selection ─────────────────────────────────────────────────────────

def pick_monitor(timeout: float = 5.0) -> Optional[dict]:
    """Show a small Tk dialog listing monitors. Auto-picks the primary monitor
    after `timeout` seconds if the user doesn't choose. Returns a dict with
    ``x``, ``y``, ``width``, ``height`` for the chosen monitor — or None when
    only one monitor exists (no dialog needed) or enumeration fails."""
    try:
        from screeninfo import get_monitors  # type: ignore
    except Exception:
        print("  screeninfo not installed — using default monitor.")
        return None

    try:
        monitors = get_monitors()
    except Exception as e:
        print(f"  monitor enumeration failed ({e}) — using default.")
        return None

    if len(monitors) <= 1:
        return None

    default_idx = next((i for i, m in enumerate(monitors) if getattr(m, "is_primary", False)), 0)

    try:
        import tkinter as tk
    except Exception:
        print("  tkinter not available — using primary monitor.")
        m = monitors[default_idx]
        return {"x": m.x, "y": m.y, "width": m.width, "height": m.height}

    chosen = {"idx": default_idx}
    remaining = {"s": int(timeout)}

    root = tk.Tk()
    root.title("RunaNet — select display")
    root.attributes("-topmost", True)
    root.resizable(False, False)
    root.configure(bg="#111")

    tk.Label(
        root, text="Choose the monitor for the display",
        font=("Segoe UI", 12, "bold"), fg="#fff", bg="#111"
    ).pack(padx=24, pady=(18, 6))

    countdown_label = tk.Label(
        root, text="", font=("Segoe UI", 10), fg="#9ca3af", bg="#111"
    )
    countdown_label.pack(pady=(0, 10))

    selected = tk.IntVar(value=default_idx)
    for i, m in enumerate(monitors):
        primary_tag = "  (primary)" if getattr(m, "is_primary", False) else ""
        label = f"Monitor {i + 1}: {m.width}×{m.height} @ ({m.x},{m.y}){primary_tag}"
        tk.Radiobutton(
            root, text=label, variable=selected, value=i,
            font=("Segoe UI", 10), fg="#fff", bg="#111",
            selectcolor="#1e3a8a", activebackground="#111",
            activeforeground="#fff", anchor="w",
        ).pack(fill="x", padx=24, pady=2)

    def confirm() -> None:
        chosen["idx"] = selected.get()
        root.destroy()

    tk.Button(
        root, text="Use this display", command=confirm,
        bg="#2563eb", fg="#fff", activebackground="#1d4ed8",
        activeforeground="#fff", relief="flat", font=("Segoe UI", 10, "bold"),
        padx=18, pady=6,
    ).pack(pady=(14, 18))

    def tick() -> None:
        if remaining["s"] <= 0:
            chosen["idx"] = selected.get()
            root.destroy()
            return
        countdown_label.config(
            text=f"Auto-selecting in {remaining['s']}s — press Use this display to keep choice"
        )
        remaining["s"] -= 1
        root.after(1000, tick)

    tick()
    root.eval(f'tk::PlaceWindow {root.winfo_pathname(root.winfo_id())} center')
    root.mainloop()

    m = monitors[chosen["idx"]]
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
    parser.add_argument("--monitor-timeout", type=float, default=5.0, help="Seconds before the monitor picker auto-selects (default 5)")
    args = parser.parse_args()

    procs: list[subprocess.Popen] = []

    def cleanup(*_: object) -> None:
        print("\nShutting down RunaNet…")
        for p in procs:
            try:
                p.terminate()
                p.wait(timeout=5)
            except Exception:
                p.kill()
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
    if args.no_fullscreen:
        monitor = None
    else:
        monitor = pick_monitor(timeout=args.monitor_timeout)
        if monitor:
            print(f"  using monitor at ({monitor['x']},{monitor['y']}) "
                  f"{monitor['width']}×{monitor['height']}")

    # ── Presence detector (lock-screen driver) ────────────────────────────────
    detector = None
    if not args.no_presence:
        try:
            from presence_detector import PresenceDetector
            detector = PresenceDetector(backend_port=args.backend_port)
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
    print("Opening display window…")
    try:
        import webview  # type: ignore
    except ImportError:
        print(
            "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "ERROR: pywebview is not installed.\n\n"
            "Install it with:\n"
            "    pip install pywebview\n\n"
            "On RPi / Linux you also need the GTK WebKit2 bindings:\n"
            "    sudo apt install python3-gi gir1.2-webkit2-4.0 libgtk-3-0\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        )
        # Services are still running; keep them alive until Ctrl+C
        print("Services are running. Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(5)
                # Restart any crashed service
                for i, p in enumerate(procs):
                    if p.poll() is not None:
                        print(f"Service {i} crashed (exit {p.returncode}), restarting…")
                        if i == 0:
                            procs[i] = start_backend(args.backend_port)
                        else:
                            procs[i] = start_frontend(args.port, args.backend_port)
        except KeyboardInterrupt:
            cleanup()

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
