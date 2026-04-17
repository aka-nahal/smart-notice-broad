"""Camera-based presence detector for the RunaNet display.

Runs in a background thread, captures a frame every ~0.5s, looks for faces,
and POSTs the result to the local backend's /api/presence endpoint. The
display's lock screen lifts when `looking=true` is reported.

Capture backends are tried in this order:
  1. picamera2   — the RPi Camera 3 stack on Raspberry Pi OS
  2. OpenCV      — any USB webcam / built-in laptop cam

If neither is available the thread exits cleanly and the lock screen simply
never engages (enabled=false).
"""

from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from typing import Optional


class PresenceDetector(threading.Thread):
    def __init__(self, backend_port: int, poll_interval: float = 0.5,
                 grace_seconds: float = 3.0) -> None:
        super().__init__(daemon=True, name="presence-detector")
        self._backend = f"http://127.0.0.1:{backend_port}/api/presence"
        self._poll = poll_interval
        # After the last face disappears we wait `grace_seconds` before
        # engaging the lock screen. Keeps the screen from flickering whenever
        # someone looks down or turns briefly.
        self._grace = grace_seconds
        self._stop = threading.Event()
        self._last_looking: Optional[bool] = None

    def stop(self) -> None:
        self._stop.set()

    # ── Capture backends ─────────────────────────────────────────────────────

    def _open_picamera2(self):
        try:
            from picamera2 import Picamera2  # type: ignore
        except Exception:
            return None
        try:
            cam = Picamera2()
            cam.configure(cam.create_preview_configuration(
                main={"format": "RGB888", "size": (640, 480)}
            ))
            cam.start()
            time.sleep(0.5)  # warmup
            return cam
        except Exception as e:
            print(f"  presence: picamera2 open failed: {e}")
            return None

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
            return cap
        except Exception as e:
            print(f"  presence: opencv open failed: {e}")
            return None

    # ── Main loop ────────────────────────────────────────────────────────────

    def run(self) -> None:
        try:
            import cv2  # type: ignore
        except Exception:
            print("  presence: OpenCV not installed — face detection disabled.")
            return

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            print("  presence: haar cascade failed to load.")
            return

        picam = self._open_picamera2()
        cvcap = None if picam else self._open_opencv()

        if not picam and not cvcap:
            print("  presence: no camera available — lock screen will stay off.")
            return

        source = "picamera2" if picam else "opencv"
        print(f"  presence: detector started ({source})")

        last_face_time = 0.0
        try:
            while not self._stop.is_set():
                frame = None
                try:
                    if picam:
                        frame = picam.capture_array()  # RGB
                        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                    else:
                        ok, frame = cvcap.read()
                        if not ok:
                            frame = None
                except Exception as e:
                    print(f"  presence: capture error: {e}")
                    frame = None

                if frame is not None:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(
                        gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60)
                    )
                    if len(faces) > 0:
                        last_face_time = time.time()

                looking = (time.time() - last_face_time) <= self._grace
                # Post every tick — heartbeat keeps `updated_at` fresh so the
                # backend's stale-detector doesn't falsely unlock the display.
                self._post(looking, source)
                self._last_looking = looking
                self._stop.wait(self._poll)
        finally:
            try:
                if picam:
                    picam.stop()
                if cvcap:
                    cvcap.release()
            except Exception:
                pass
            self._post(False, source, enabled=False)

    def _post(self, looking: bool, source: str, enabled: bool = True) -> None:
        body = json.dumps({
            "looking": bool(looking),
            "enabled": bool(enabled),
            "source":  source,
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
