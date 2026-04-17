"""Camera-based presence detector for the RunaNet display.

Runs in a background thread, samples a low-res grayscale frame every ~0.5s,
looks for faces, and POSTs the result to the local backend's /api/presence
endpoint. The display's lock screen lifts when `looking=true` is reported.

Capture backends, tried in order:
  1. rpicam-vid (or legacy libcamera-vid)
       We spawn the CLI tool with `--codec yuv420 -o -`, so it writes raw
       YUV420 frames to stdout. We read them frame-by-frame and use the Y
       (luminance) plane directly - Haar wants grayscale anyway, so there is
       no decode or colour conversion. Works with any libcamera-supported
       sensor including the Camera Module 3 Wide NoIR (IMX708).
  2. OpenCV VideoCapture
       Fallback for USB webcams on desktop / Pi with no CSI camera.

If neither backend is available, the thread exits cleanly and the lock
screen stays disabled (backend sets `enabled=false`).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
from typing import Optional

# Capture size. 640x480 is a sweet spot for Haar face detection at ~1-3m
# from the display: big enough to resolve faces, small enough that each
# detectMultiScale call stays cheap on a Pi. rpicam-vid rounds to what the
# sensor can stream and the ISP scales to these dimensions for us.
CAPTURE_W, CAPTURE_H = 640, 480

# Target frame rate for the streamer. We only poll twice a second, but
# leaving a little headroom catches motion well without taxing the Pi.
CAPTURE_FPS = 10


class _RpicamStream:
    """Thin wrapper around a `rpicam-vid` child process that streams raw
    YUV420 frames to stdout. Reads exactly one frame per `read()` call."""

    def __init__(self, binary: str, width: int, height: int, fps: int) -> None:
        self._binary = binary
        self._w = width
        self._h = height
        # YUV420 = w*h luminance + w*h/2 chrominance (2x2 subsampled).
        self._frame_bytes = width * height * 3 // 2
        # -t 0        : stream forever, no timeout
        # -n          : no preview window (we're headless, no DRM target)
        # --codec yuv420 : raw frames, one after another, no container
        # --flush     : push each frame out immediately, don't buffer
        # -o -        : write to stdout
        cmd = [
            binary,
            "-t", "0",
            "-n",
            "--width",  str(width),
            "--height", str(height),
            "--framerate", str(fps),
            "--codec", "yuv420",
            "--flush",
            "-o", "-",
        ]
        self._proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        )

    def read(self) -> Optional[bytes]:
        """Return one frame's worth of bytes, or None on stream close."""
        assert self._proc.stdout is not None
        buf = bytearray()
        need = self._frame_bytes
        while need > 0:
            chunk = self._proc.stdout.read(need)
            if not chunk:
                return None
            buf.extend(chunk)
            need -= len(chunk)
        return bytes(buf)

    def alive(self) -> bool:
        return self._proc.poll() is None

    def close(self) -> None:
        try:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        except Exception:
            pass


class PresenceDetector(threading.Thread):
    def __init__(self, backend_port: int, poll_interval: float = 0.2,
                 grace_seconds: float = 20.0) -> None:
        super().__init__(daemon=True, name="presence-detector")
        self._backend = f"http://127.0.0.1:{backend_port}/api/presence"
        self._poll = poll_interval
        # After the last face disappears we wait `grace_seconds` before
        # engaging the lock screen. 20s is the default: long enough that a
        # reader can glance away (to take notes, talk to someone, turn to
        # read a nearby notice) without the board blanking out on them, but
        # short enough that the screen doesn't stay lit for an empty hallway.
        self._grace = grace_seconds
        self._stop = threading.Event()
        self._last_looking: Optional[bool] = None

    def stop(self) -> None:
        self._stop.set()

    # ── Capture backends ─────────────────────────────────────────────────────

    def _open_rpicam(self) -> Optional[_RpicamStream]:
        """Start `rpicam-vid` (or its legacy alias) as a subprocess feeding
        raw YUV420 to stdout. Returns None if neither binary is present or
        the child fails to start (no camera detected)."""
        binary = shutil.which("rpicam-vid") or shutil.which("libcamera-vid")
        if not binary:
            return None
        try:
            stream = _RpicamStream(binary, CAPTURE_W, CAPTURE_H, CAPTURE_FPS)
        except Exception as e:
            print(f"  presence: {binary} failed to start: {e}")
            return None
        # Give the sensor a beat to warm up and the first frame to arrive,
        # then verify the process is actually streaming. If rpicam-vid can't
        # find a camera it exits within ~0.5s with a non-zero code.
        time.sleep(0.8)
        if not stream.alive():
            stream.close()
            print(f"  presence: {binary} exited immediately (no camera?)")
            return None
        return stream

    def _open_opencv(self):
        try:
            import cv2  # type: ignore
        except Exception:
            return None
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                cap.release()
                return None
            cap.set(cv2.CAP_PROP_FRAME_WIDTH,  CAPTURE_W)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_H)
            return cap
        except Exception as e:
            print(f"  presence: opencv open failed: {e}")
            return None

    # ── Main loop ────────────────────────────────────────────────────────────

    def run(self) -> None:
        try:
            import cv2  # type: ignore
            import numpy as np  # type: ignore
        except Exception:
            print("  presence: OpenCV / NumPy not installed - face detection disabled.")
            return

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            print("  presence: haar cascade failed to load.")
            return

        rpicam = self._open_rpicam()
        cvcap = None if rpicam else self._open_opencv()

        if not rpicam and not cvcap:
            print("  presence: no camera available - lock screen will stay off.")
            return

        source = "rpicam-vid" if rpicam else "opencv"
        print(f"  presence: detector started ({source}, {CAPTURE_W}x{CAPTURE_H}@{CAPTURE_FPS}fps)")

        last_face_time = 0.0
        try:
            while not self._stop.is_set():
                gray = None
                try:
                    if rpicam:
                        raw = rpicam.read()
                        if raw is None:
                            print("  presence: rpicam stream ended")
                            break
                        # First W*H bytes are the Y plane - that's our
                        # grayscale image, no conversion needed.
                        gray = np.frombuffer(
                            raw, dtype=np.uint8, count=CAPTURE_W * CAPTURE_H
                        ).reshape(CAPTURE_H, CAPTURE_W)
                    else:
                        ok, frame = cvcap.read()
                        if ok:
                            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                except Exception as e:
                    print(f"  presence: capture error: {e}")
                    gray = None

                face_info = None
                if gray is not None:
                    # Tuned for faces at ~1-3m from the board with the
                    # Camera Module 3 Wide FOV. minSize filters out framed
                    # posters / stray patterns that Haar otherwise
                    # false-positives on.
                    faces = face_cascade.detectMultiScale(
                        gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60)
                    )
                    if len(faces) > 0:
                        last_face_time = time.time()
                        # Pick the biggest face (closest viewer wins when
                        # several are in frame — the lockscreen emoji has
                        # one pair of eyes, it can only look at one person).
                        fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                        # Mirror x so "viewer moves right" → x increases,
                        # which makes the emoji's gaze follow naturally.
                        face_info = {
                            "x":    float(1.0 - (fx + fw / 2) / CAPTURE_W),
                            "y":    float((fy + fh / 2) / CAPTURE_H),
                            "area": float((fw * fh) / (CAPTURE_W * CAPTURE_H)),
                        }

                looking = (time.time() - last_face_time) <= self._grace
                # Post every tick - heartbeat keeps `updated_at` fresh so
                # the backend's stale-detector doesn't falsely unlock.
                self._post(looking, source, face=face_info)
                self._last_looking = looking
                self._stop.wait(self._poll)
        finally:
            try:
                if rpicam:
                    rpicam.close()
                if cvcap:
                    cvcap.release()
            except Exception:
                pass
            self._post(False, source, enabled=False)

    def _post(self, looking: bool, source: str, enabled: bool = True,
              face: Optional[dict] = None) -> None:
        body = json.dumps({
            "looking": bool(looking),
            "enabled": bool(enabled),
            "source":  source,
            "face":    face,
        }).encode()
        req = urllib.request.Request(
            self._backend, data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=2).read()
        except (urllib.error.URLError, TimeoutError):
            pass
