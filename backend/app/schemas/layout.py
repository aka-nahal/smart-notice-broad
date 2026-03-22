from datetime import datetime

from pydantic import BaseModel, Field


class TileCreate(BaseModel):
    tile_type: str = "notice"
    grid_x: int = 0
    grid_y: int = 0
    grid_w: int = 1
    grid_h: int = 1
    z_index: int = 0
    priority_weight: int = 0
    refresh_interval_sec: int | None = None
    animation_style: str | None = None
    config_json: str | None = None
    is_emergency_slot: bool = False
    notice_id: int | None = None
    media_id: int | None = None


class TileUpdate(BaseModel):
    tile_type: str | None = None
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None
    z_index: int | None = None
    priority_weight: int | None = None
    refresh_interval_sec: int | None = None
    animation_style: str | None = None
    config_json: str | None = None
    is_emergency_slot: bool | None = None
    notice_id: int | None = None
    media_id: int | None = None


class TileRead(BaseModel):
    id: int
    layout_version_id: int
    tile_type: str
    grid_x: int
    grid_y: int
    grid_w: int
    grid_h: int
    z_index: int
    priority_weight: int
    refresh_interval_sec: int | None
    animation_style: str | None
    config_json: str | None
    is_emergency_slot: bool
    notice_id: int | None
    media_id: int | None

    model_config = {"from_attributes": True}


class LayoutVersionRead(BaseModel):
    id: int
    layout_id: int
    version: int
    grid_cols: int
    grid_rows: int
    gap_px: int
    is_published: bool
    published_at: datetime | None
    meta_json: str | None
    tiles: list[TileRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class LayoutRead(BaseModel):
    id: int
    name: str
    description: str | None
    is_template: bool
    versions: list[LayoutVersionRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class LayoutCreate(BaseModel):
    name: str = "Untitled"
    description: str | None = None
    grid_cols: int = 12
    grid_rows: int = 12
    gap_px: int = 8
