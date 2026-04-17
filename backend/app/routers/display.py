import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.display import DisplayBundle
from app.services.display_bundle import build_display_bundle
from app.services.memcache import display_bundle_cache

router = APIRouter()

# ---------------------------------------------------------------------------
# Resolution: persisted to disk once, then served from RAM. Disk write is
# skipped when the payload hasn't actually changed.
# ---------------------------------------------------------------------------
_RES_FILE = Path("./data/last_resolution.json")


def _load_resolution() -> dict | None:
    try:
        if _RES_FILE.exists():
            return json.loads(_RES_FILE.read_text())
    except Exception:
        pass
    return None


def _save_resolution(payload: dict) -> None:
    try:
        _RES_FILE.parent.mkdir(parents=True, exist_ok=True)
        _RES_FILE.write_text(json.dumps(payload))
    except Exception:
        pass


_last_resolution: dict | None = _load_resolution()


@router.get("/bundle", response_model=DisplayBundle)
async def get_display_bundle(
    layout_version_id: int | None = Query(default=None),
    mode: str = Query(default="grid"),
    focus_tile_id: int | None = Query(default=None),
    fresh: bool = Query(default=False, description="Bypass the in-RAM cache"),
    db: AsyncSession = Depends(get_db),
) -> DisplayBundle:
    key = (layout_version_id, mode, focus_tile_id)

    if fresh:
        display_bundle_cache.invalidate(key)

    async def _loader() -> DisplayBundle:
        return await build_display_bundle(
            db,
            layout_version_id=layout_version_id,
            mode=mode,
            focus_tile_id=focus_tile_id,
        )

    return await display_bundle_cache.get_or_load(key, _loader)


@router.post("/resolution")
async def report_resolution(data: dict) -> dict:
    """Called by the display device on load to report its screen dimensions."""
    global _last_resolution
    payload = {
        "width":       int(data.get("width", 1920)),
        "height":      int(data.get("height", 1080)),
        "dpr":         float(data.get("dpr", 1.0)),
        "reported_at": datetime.utcnow().isoformat(),
    }
    # Skip disk write when only timestamp changed — keeps the SD card happy
    # on Raspberry Pi deployments where the same display reports each refresh.
    prev = _last_resolution or {}
    geometry_changed = (
        prev.get("width")  != payload["width"]  or
        prev.get("height") != payload["height"] or
        prev.get("dpr")    != payload["dpr"]
    )
    _last_resolution = payload
    if geometry_changed:
        _save_resolution(payload)
    return payload


@router.get("/resolution")
async def get_resolution() -> dict:
    """Returns the last resolution reported by the display device — served from RAM."""
    return _last_resolution or {"width": None, "height": None, "dpr": None, "reported_at": None}
