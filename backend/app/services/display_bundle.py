from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.layout import LayoutVersion
from app.models.tile import Tile
from app.schemas.display import DisplayBundle, DisplayTileDTO
from app.schemas.layout import TileRead
from app.serializers import notice_to_read


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _tile_visible_now(tile: Tile, now: datetime) -> bool:
    if not tile.schedules:
        return True
    now_u = now
    for rule in tile.schedules:
        s = _naive_utc(rule.start_at)
        e = _naive_utc(rule.end_at)
        ex = _naive_utc(rule.expires_at)
        if s and now_u < s:
            return False
        if e and now_u > e:
            return False
        if ex and now_u > ex:
            return False
    return True


async def build_display_bundle(
    session,
    *,
    layout_version_id: int | None = None,
    mode: str = "grid",
    focus_tile_id: int | None = None,
) -> DisplayBundle:
    now = _now_utc()
    if layout_version_id is not None:
        q = (
            select(LayoutVersion)
            .options(
                selectinload(LayoutVersion.tiles).selectinload(Tile.notice),
                selectinload(LayoutVersion.tiles).selectinload(Tile.schedules),
            )
            .where(LayoutVersion.id == layout_version_id)
        )
    else:
        q = (
            select(LayoutVersion)
            .options(
                selectinload(LayoutVersion.tiles).selectinload(Tile.notice),
                selectinload(LayoutVersion.tiles).selectinload(Tile.schedules),
            )
            .where(LayoutVersion.is_published.is_(True))
            .order_by(LayoutVersion.id.desc())
            .limit(1)
        )

    result = await session.execute(q)
    lv = result.scalar_one_or_none()
    if lv is None:
        return DisplayBundle(
            layout_version_id=0,
            grid_cols=12,
            grid_rows=12,
            gap_px=8,
            mode=mode,
            focus_tile_id=focus_tile_id,
            tiles=[],
            server_time_utc=now.isoformat(),
        )

    dtos: list[DisplayTileDTO] = []
    emergency = [t for t in lv.tiles if t.is_emergency_slot or t.tile_type == "emergency"]
    if mode == "emergency" and emergency:
        tiles_iter = emergency
    else:
        tiles_iter = sorted(lv.tiles, key=lambda t: (t.z_index, t.id))

    for tile in tiles_iter:
        visible = _tile_visible_now(tile, now)
        eff = tile.priority_weight + (tile.notice.priority if tile.notice else 0)
        for r in tile.schedules:
            eff += r.priority_boost
        dtos.append(
            DisplayTileDTO(
                tile=TileRead.model_validate(tile),
                notice=notice_to_read(tile.notice) if tile.notice else None,
                media_url=f"/api/media/{tile.media_id}" if tile.media_id else None,
                effective_priority=eff,
                is_visible_by_schedule=visible,
            )
        )

    return DisplayBundle(
        layout_version_id=lv.id,
        grid_cols=lv.grid_cols,
        grid_rows=lv.grid_rows,
        gap_px=lv.gap_px,
        mode=mode,
        focus_tile_id=focus_tile_id,
        tiles=dtos,
        server_time_utc=now.isoformat(),
    )
