from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.layout import Layout, LayoutVersion
from app.models.tile import Tile
from app.services.memcache import display_bundle_cache
from app.schemas.layout import (
    LayoutCreate,
    LayoutRead,
    LayoutUpdate,
    LayoutVersionRead,
    LayoutVersionUpdate,
    TileBulkUpdate,
    TileCreate,
    TileRead,
    TileUpdate,
    VersionClone,
)

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
                tiles=[
                    TileRead.model_validate(t)
                    for t in sorted(v.tiles, key=lambda t: (t.z_index, t.id))
                ],
            )
        )
    return LayoutRead(
        id=layout.id,
        name=layout.name,
        description=layout.description,
        is_template=layout.is_template,
        versions=versions,
    )


async def _version_read_with_tiles(db: AsyncSession, version_id: int) -> LayoutVersionRead:
    result = await db.execute(
        select(LayoutVersion)
        .options(selectinload(LayoutVersion.tiles))
        .where(LayoutVersion.id == version_id)
    )
    lv = result.scalar_one()
    return LayoutVersionRead(
        id=lv.id,
        layout_id=lv.layout_id,
        version=lv.version,
        grid_cols=lv.grid_cols,
        grid_rows=lv.grid_rows,
        gap_px=lv.gap_px,
        is_published=lv.is_published,
        published_at=lv.published_at,
        meta_json=lv.meta_json,
        tiles=[
            TileRead.model_validate(t)
            for t in sorted(lv.tiles, key=lambda t: (t.z_index, t.id))
        ],
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
async def create_layout(
    body: LayoutCreate, db: AsyncSession = Depends(get_db)
) -> LayoutRead:
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


@router.patch("/{layout_id}", response_model=LayoutRead)
async def update_layout(
    layout_id: int,
    body: LayoutUpdate,
    db: AsyncSession = Depends(get_db),
) -> LayoutRead:
    layout = await db.get(Layout, layout_id)
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(layout, k, v)
    await db.commit()
    return await _layout_read(db, layout_id)


@router.delete("/{layout_id}")
async def delete_layout(
    layout_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(Layout)
        .options(selectinload(Layout.versions).selectinload(LayoutVersion.tiles))
        .where(Layout.id == layout_id)
    )
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    for v in layout.versions:
        for t in v.tiles:
            await db.delete(t)
        await db.delete(v)
    await db.delete(layout)
    await db.commit()
    return {"status": "ok"}


@router.patch("/{layout_id}/versions/{version_id}", response_model=LayoutVersionRead)
async def update_version(
    layout_id: int,
    version_id: int,
    body: LayoutVersionUpdate,
    db: AsyncSession = Depends(get_db),
) -> LayoutVersionRead:
    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lv, k, v)
    await db.commit()
    await db.refresh(lv)
    return await _version_read_with_tiles(db, version_id)


# ---- Clone a version (create new version from existing) ----

@router.post("/{layout_id}/versions", response_model=LayoutVersionRead)
async def clone_version(
    layout_id: int,
    body: VersionClone | None = None,
    db: AsyncSession = Depends(get_db),
) -> LayoutVersionRead:
    layout = await db.get(Layout, layout_id)
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")

    # Find source version
    if body and body.source_version_id:
        source = await db.get(LayoutVersion, body.source_version_id)
        if not source or source.layout_id != layout_id:
            raise HTTPException(status_code=404, detail="Source version not found")
    else:
        # Use latest version
        result = await db.execute(
            select(LayoutVersion)
            .where(LayoutVersion.layout_id == layout_id)
            .order_by(LayoutVersion.version.desc())
            .limit(1)
        )
        source = result.scalar_one_or_none()
        if not source:
            raise HTTPException(status_code=404, detail="No existing version to clone")

    # Load source tiles
    result = await db.execute(
        select(LayoutVersion)
        .options(selectinload(LayoutVersion.tiles))
        .where(LayoutVersion.id == source.id)
    )
    source = result.scalar_one()

    # Get next version number
    result = await db.execute(
        select(func.max(LayoutVersion.version))
        .where(LayoutVersion.layout_id == layout_id)
    )
    max_ver = result.scalar() or 0

    # Create new version
    new_lv = LayoutVersion(
        layout_id=layout_id,
        version=max_ver + 1,
        grid_cols=source.grid_cols,
        grid_rows=source.grid_rows,
        gap_px=source.gap_px,
        is_published=False,
        meta_json=source.meta_json,
    )
    db.add(new_lv)
    await db.flush()

    # Clone tiles
    for t in source.tiles:
        new_tile = Tile(
            layout_version_id=new_lv.id,
            tile_type=t.tile_type,
            grid_x=t.grid_x,
            grid_y=t.grid_y,
            grid_w=t.grid_w,
            grid_h=t.grid_h,
            z_index=t.z_index,
            priority_weight=t.priority_weight,
            refresh_interval_sec=t.refresh_interval_sec,
            animation_style=t.animation_style,
            config_json=t.config_json,
            is_emergency_slot=t.is_emergency_slot,
            notice_id=t.notice_id,
            media_id=t.media_id,
        )
        db.add(new_tile)

    await db.commit()
    return await _version_read_with_tiles(db, new_lv.id)


# ---- Tiles CRUD ----

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
    display_bundle_cache.invalidate()
    return TileRead.model_validate(tile)


# ---- Bulk update tiles ----

@router.post(
    "/{layout_id}/versions/{version_id}/tiles/bulk",
    response_model=list[TileRead],
)
async def bulk_update_tiles(
    layout_id: int,
    version_id: int,
    body: TileBulkUpdate,
    db: AsyncSession = Depends(get_db),
) -> list[TileRead]:
    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")

    updated: list[TileRead] = []
    for item in body.tiles:
        tile = await db.get(Tile, item.id)
        if not tile or tile.layout_version_id != version_id:
            continue
        for k, v in item.model_dump(exclude_unset=True, exclude={"id"}).items():
            setattr(tile, k, v)
        updated.append(tile)

    await db.commit()
    display_bundle_cache.invalidate()
    result = []
    for tile in updated:
        await db.refresh(tile)
        result.append(TileRead.model_validate(tile))
    return result


@router.patch(
    "/{layout_id}/versions/{version_id}/tiles/{tile_id}", response_model=TileRead
)
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
    display_bundle_cache.invalidate()
    return TileRead.model_validate(tile)


@router.delete("/{layout_id}/versions/{version_id}/tiles/{tile_id}")
async def delete_tile(
    layout_id: int,
    version_id: int,
    tile_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    tile = await db.get(Tile, tile_id)
    if not tile or tile.layout_version_id != version_id:
        raise HTTPException(status_code=404, detail="Tile not found")
    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")
    await db.delete(tile)
    await db.commit()
    display_bundle_cache.invalidate()
    return {"status": "ok"}


@router.post("/{layout_id}/versions/{version_id}/publish")
async def publish_version(
    layout_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    lv = await db.get(LayoutVersion, version_id)
    if not lv or lv.layout_id != layout_id:
        raise HTTPException(status_code=404, detail="Layout version not found")
    result = await db.execute(
        select(LayoutVersion).where(LayoutVersion.layout_id == layout_id)
    )
    all_v = result.scalars().all()
    for v in all_v:
        v.is_published = False
    lv.is_published = True
    lv.published_at = datetime.utcnow()
    await db.commit()
    display_bundle_cache.invalidate()
    return {"status": "published", "layout_version_id": str(version_id)}
