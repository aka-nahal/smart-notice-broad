from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ScheduleRule(Base):
    __tablename__ = "schedule_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tile_id: Mapped[int] = mapped_column(ForeignKey("tiles.id"), index=True)
    start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recurrence_rrule: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    priority_boost: Mapped[int] = mapped_column(Integer, default=0)
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    tile: Mapped["Tile"] = relationship(back_populates="schedules")
