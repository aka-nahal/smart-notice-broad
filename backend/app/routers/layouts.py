from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.layout import Layout, LayoutVersion
from app.models.tile import Tile
from app.schemas.layout import LayoutCreate, LayoutRead, LayoutVersionRead, TileCreate, TileRead, TileUpdate

router = APIRouter()


async def _layout_read(db: AsyncSession, layout_id: int) -> LayoutRead:
    result = await db.execute(
        select(Layout)
        .options(selectinload(Layout.versions).selectinload(LayoutVersion.tiles))
        .where(Layout.id == layout_id)
    )
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    versions = []
    for v in sorted(layout.versions, key=lambda x: -x.version):
        versions.append(
            LayoutVersionRead(
                id=v.id,
                layout_id=v.layout_id,
                version=v.version,
                grid_cols=v.grid_cols,
                grid_rows=v.grid_rows,
                gap_px=v.gap_px,
                is_published=v.is_published,
                published_at=v.published_at,
                meta_json=v.meta_json,
                tiles=[TileRead.model_validate(t) for t in sorted(v.tiles, key=lambda t: (t.z_index, t.id))],
            )
        )
    return LayoutRead(
        id=layout.id,
        name=layout.name,
        description=layout.description,
        is_template=layout.is_template,
        versions=versions,
    )


@router.get("", response_model=list[LayoutRead])
async def list_layouts(db: AsyncSession = Depends(get_db)) -> list[LayoutRead]:
    result = await db.execute(select(Layout.id))
    ids = [row[0] for row in result.all()]
    out: list[LayoutRead] = []
    for lid in ids:
        out.append(await _layout_read(db, lid))
    return out


@router.post("", response_model=LayoutRead)
async def create_layout(body: LayoutCreate, db: AsyncSession = Depends(get_db)) -> LayoutRead:
    layout = Layout(name=body.name, description=body.description)
    db.add(layout)
    await db.flush()
    lv = LayoutVersion(
        layout_id=layout.id,
        version=1,
        grid_cols=body.grid_cols,
        grid_rows=body.grid_rows,
        gap_px=body.gap_px,
        is_published=False,
    )
    db.add(lv)
    await db.commit()
    return await _layout_read(db, layout.id)


@router.get("/{layout_id}", response_model=LayoutRead)
async def get_layout(layout_id: int, db: AsyncSession = Depends(get_db)) -> LayoutRead:
    return await _layout_read(db, layout_id)


@router.post("/{layout_id}/versions/{version_id}/tiles", response_model=TileRead)
async def add_tile(
    layout_id: int,
    version_id: int,
    body: TileCreate,
    db: AsyncSession = Depends(get_db),
) -> TileRead:
    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")
    tile = Tile(
        layout_version_id=version_id,
        tile_type=body.tile_type,
        grid_x=body.grid_x,
        grid_y=body.grid_y,
        grid_w=body.grid_w,
        grid_h=body.grid_h,
        z_index=body.z_index,
        priority_weight=body.priority_weight,
        refresh_interval_sec=body.refresh_interval_sec,
        animation_style=body.animation_style,
        config_json=body.config_json,
        is_emergency_slot=body.is_emergency_slot,
        notice_id=body.notice_id,
        media_id=body.media_id,
    )
    db.add(tile)
    await db.commit()
    await db.refresh(tile)
    return TileRead.model_validate(tile)


@router.patch("/{layout_id}/versions/{version_id}/tiles/{tile_id}", response_model=TileRead)
async def update_tile(
    layout_id: int,
    version_id: int,
    tile_id: int,
    body: TileUpdate,
    db: AsyncSession = Depends(get_db),
) -> TileRead:
    tile = await db.get(Tile, tile_id)
    if not tile or tile.layout_version_id != version_id:
        raise HTTPException(status_code=404, detail="Tile not found")
    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tile, k, v)
    await db.commit()
    await db.refresh(tile)
    return TileRead.model_validate(tile)


@router.post("/{layout_id}/versions/{version_id}/publish")
async def publish_version(
    layout_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    from datetime import datetime

    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")
    result = await db.execute(select(LayoutVersion).where(LayoutVersion.layout_id == layout_id))
    all_v = result.scalars().all()
    for v in all_v:
        v.is_published = False
    lv.is_published = True
    lv.published_at = datetime.utcnow()
    await db.commit()
    return {"status": "published", "layout_version_id": str(version_id)}
