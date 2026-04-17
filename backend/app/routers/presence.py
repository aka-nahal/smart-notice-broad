"""Presence tracking for the display's lock-screen.

The launcher runs a camera-based detector (RPi Camera 3 via picamera2, or a
USB webcam via OpenCV) and POSTs updates here. The /display page polls the
GET endpoint and lifts the lock screen when a viewer is present.

State lives in process memory — it is ephemeral by design.
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class PresenceState(BaseModel):
    looking: bool = False
    enabled: bool = False
    last_seen: Optional[float] = None
    updated_at: float = 0.0
    source: Optional[str] = None


class PresenceUpdate(BaseModel):
    looking: bool
    enabled: bool = True
    source: Optional[str] = None


_state = PresenceState()

# If no update arrives for this many seconds we assume the detector died and
# fall back to "presence unknown" — which unlocks the screen rather than
# leaving it stuck on the lock screen forever.
_STALE_AFTER_S = 10.0


@router.get("", response_model=PresenceState)
def get_presence() -> PresenceState:
    if _state.enabled and _state.updated_at:
        if time.time() - _state.updated_at > _STALE_AFTER_S:
            return PresenceState(looking=True, enabled=False, source="stale")
    return _state


@router.post("", response_model=PresenceState)
def post_presence(update: PresenceUpdate) -> PresenceState:
    global _state
    now = time.time()
    _state = PresenceState(
        looking=update.looking,
        enabled=update.enabled,
        last_seen=now if update.looking else _state.last_seen,
        updated_at=now,
        source=update.source,
    )
    return _state
