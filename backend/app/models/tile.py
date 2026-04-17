from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TileType(str, Enum):
    NOTICE = "notice"
    IMAGE = "image"
    VIDEO = "video"
    PDF = "pdf"
    EVENT = "event"
    CLOCK = "clock"
    WEATHER = "weather"
    TICKER = "ticker"
    BANNER = "banner"
    EMERGENCY = "emergency"
    SENSOR = "sensor"
    TIMETABLE = "timetable"
    CUSTOM = "custom"


class Tile(Base):
    __tablename__ = "tiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    layout_version_id: Mapped[int] = mapped_column(
        ForeignKey("layout_versions.id"), index=True
    )
    notice_id: Mapped[int | None] = mapped_column(
        ForeignKey("notices.id"), nullable=True, index=True
    )
    media_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id"), nullable=True
    )

    tile_type: Mapped[str] = mapped_column(String(32), default=TileType.NOTICE.value)
    grid_x: Mapped[int] = mapped_column(Integer, default=0)
    grid_y: Mapped[int] = mapped_column(Integer, default=0)
    grid_w: Mapped[int] = mapped_column(Integer, default=1)
    grid_h: Mapped[int] = mapped_column(Integer, default=1)
    z_index: Mapped[int] = mapped_column(Integer, default=0)
    priority_weight: Mapped[int] = mapped_column(Integer, default=0)
    refresh_interval_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    animation_style: Mapped[str | None] = mapped_column(String(64), nullable=True)
    config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_emergency_slot: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    layout_version: Mapped["LayoutVersion"] = relationship(back_populates="tiles")
    notice: Mapped["Notice | None"] = relationship(back_populates="tiles")
    schedules: Mapped[list["ScheduleRule"]] = relationship(back_populates="tile")
