from datetime import datetime

from pydantic import BaseModel, Field


class TileCreate(BaseModel):
    tile_type: str = "notice"
    grid_x: int = Field(default=0, ge=0)
    grid_y: int = Field(default=0, ge=0)
    grid_w: int = Field(default=1, ge=1, le=24)
    grid_h: int = Field(default=1, ge=1, le=24)
    z_index: int = Field(default=0, ge=0, le=99)
    priority_weight: int = Field(default=0, ge=0, le=100)
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


class LayoutVersionUpdate(BaseModel):
    grid_cols: int | None = Field(default=None, ge=1, le=24)
    grid_rows: int | None = Field(default=None, ge=1, le=24)
    gap_px: int | None = Field(default=None, ge=0, le=32)
    meta_json: str | None = None


class TileBulkUpdateItem(BaseModel):
    id: int
    tile_type: str | None = None
    grid_x: int | None = None
    grid_y: int | None = None
    grid_w: int | None = None
    grid_h: int | None = None
    z_index: int | None = None
    priority_weight: int | None = None
    notice_id: int | None = None
    config_json: str | None = None
    is_emergency_slot: bool | None = None


class TileBulkUpdate(BaseModel):
    tiles: list[TileBulkUpdateItem]


class VersionClone(BaseModel):
    source_version_id: int | None = None


class LayoutCreate(BaseModel):
    name: str = "Untitled"
    description: str | None = None
    grid_cols: int = Field(default=12, ge=1, le=24)
    grid_rows: int = Field(default=12, ge=1, le=24)
    gap_px: int = Field(default=8, ge=0, le=32)


class LayoutUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
