#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RunaNet bootstrapper - cross-platform setup + launch.

Works identically on Windows, macOS, and Raspberry Pi OS. Ensures Python and
Node dependencies are installed, then hands off to ``launcher.py`` with any
arguments you passed through.

Usage
-----
    python start.py                  # fullscreen display
    python start.py --no-fullscreen  # windowed (development)
    python start.py --build          # rebuild frontend first
    python start.py --no-presence    # skip camera-based lock screen
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

# Force stdout/stderr to UTF-8 on Windows consoles (cp1252 by default) so any
# unicode in our status messages doesn't crash the bootstrapper.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"


def run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> int:
    """Run a subprocess, streaming its output. On Windows we need shell=True for
    ``npm`` because it is shipped as ``npm.cmd`` and not directly executable."""
    use_shell = os.name == "nt" and cmd and cmd[0] in {"npm", "npx"}
    display = " ".join(cmd)
    print(f"  $ {display}")
    result = subprocess.run(cmd, cwd=cwd, shell=use_shell)
    if check and result.returncode != 0:
        sys.exit(f"\nCommand failed ({display!r}) with exit {result.returncode}")
    return result.returncode


def python_has(module: str) -> bool:
    return subprocess.run(
        [sys.executable, "-c", f"import {module}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode == 0


# After a failed pywebview install we write this marker so subsequent launches
# don't waste ~30s re-downloading pythonnet just to watch it fail again.
# Tagged with the Python version so a user upgrade invalidates the skip.
_SKIP_MARKER = ROOT / "data" / ".pywebview-install-skipped"


def _pywebview_skip_key() -> str:
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def _should_skip_pywebview() -> bool:
    try:
        return _SKIP_MARKER.read_text().strip() == _pywebview_skip_key()
    except Exception:
        return False


def _mark_pywebview_skipped() -> None:
    try:
        _SKIP_MARKER.parent.mkdir(parents=True, exist_ok=True)
        _SKIP_MARKER.write_text(_pywebview_skip_key())
    except Exception:
        pass


def ensure_display_deps() -> None:
    # Only install what's genuinely missing. Each package is checked
    # independently so a failed optional dep doesn't block the others.
    need_webview    = not python_has("webview")     and not _should_skip_pywebview()
    need_screeninfo = not python_has("screeninfo")
    need_cv2        = not python_has("cv2")

    if not (need_webview or need_screeninfo or need_cv2):
        return

    missing = [n for n, want in
               [("pywebview", need_webview), ("screeninfo", need_screeninfo),
                ("opencv-python", need_cv2)] if want]
    print(f"-> Installing display dependencies: {', '.join(missing)}")

    # pywebview is optional (Edge/Chrome fallback kicks in without it) and on
    # Python 3.14 Windows it can't build because pythonnet has no wheel - so
    # we install it LAST and on its own, so a failure doesn't take out the
    # required deps or leave pip in a partial state.
    if need_screeninfo or need_cv2:
        pkgs = []
        if need_screeninfo: pkgs.append("screeninfo>=0.8")
        if need_cv2:        pkgs.append("opencv-python>=4.8")
        run([sys.executable, "-m", "pip", "install", *pkgs])

    if need_webview:
        rc = run([sys.executable, "-m", "pip", "install", "pywebview>=5.0"], check=False)
        if rc != 0:
            _mark_pywebview_skipped()
            print("   pywebview install failed - skipping on future runs (cached in "
                  f"{_SKIP_MARKER.relative_to(ROOT)}).")
            print("   The launcher will open the display in Edge/Chrome instead.")


def ensure_backend_deps() -> None:
    req = BACKEND / "requirements.txt"
    if not req.exists():
        return
    print("-> Ensuring backend dependencies...")
    run([sys.executable, "-m", "pip", "install", "-r", str(req), "-q"])


def ensure_frontend_deps() -> None:
    if (FRONTEND / "node_modules").is_dir():
        return
    if shutil.which("npm") is None:
        sys.exit("\nnpm not found on PATH. Install Node.js 18+ from https://nodejs.org")
    print("-> Installing frontend dependencies (first run only)...")
    run(["npm", "install", "--silent"], cwd=FRONTEND)


def main() -> None:
    print(f"RunaNet bootstrapper - {ROOT}")
    ensure_display_deps()
    ensure_backend_deps()
    ensure_frontend_deps()

    launcher_args = sys.argv[1:]
    # Replace this process with launcher.py so Ctrl+C and exit codes behave
    # exactly as if you ran launcher.py directly.
    os.execv(sys.executable, [sys.executable, str(ROOT / "launcher.py"), *launcher_args])


if __name__ == "__main__":
    main()
