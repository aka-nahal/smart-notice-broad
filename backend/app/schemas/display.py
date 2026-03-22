from pydantic import BaseModel, Field

from app.schemas.layout import TileRead
from app.schemas.notice import NoticeRead


class DisplayTileDTO(BaseModel):
    tile: TileRead
    notice: NoticeRead | None = None
    media_url: str | None = None
    effective_priority: int = 0
    is_visible_by_schedule: bool = True


class DisplayBundle(BaseModel):
    layout_version_id: int
    grid_cols: int
    grid_rows: int
    gap_px: int
    mode: str = "grid"  # grid | focus | emergency
    focus_tile_id: int | None = None
    tiles: list[DisplayTileDTO] = Field(default_factory=list)
    server_time_utc: str
