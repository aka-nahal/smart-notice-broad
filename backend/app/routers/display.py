from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.display import DisplayBundle
from app.services.display_bundle import build_display_bundle

router = APIRouter()


@router.get("/bundle", response_model=DisplayBundle)
async def get_display_bundle(
    layout_version_id: int | None = Query(default=None),
    mode: str = Query(default="grid"),
    focus_tile_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> DisplayBundle:
    return await build_display_bundle(
        db,
        layout_version_id=layout_version_id,
        mode=mode,
        focus_tile_id=focus_tile_id,
    )
