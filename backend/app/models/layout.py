from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Layout(Base):
    __tablename__ = "layouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), default="Untitled")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions: Mapped[list["LayoutVersion"]] = relationship(back_populates="layout")


class LayoutVersion(Base):
    __tablename__ = "layout_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    layout_id: Mapped[int] = mapped_column(ForeignKey("layouts.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    grid_cols: Mapped[int] = mapped_column(Integer, default=12)
    grid_rows: Mapped[int] = mapped_column(Integer, default=12)
    gap_px: Mapped[int] = mapped_column(Integer, default=8)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    layout: Mapped["Layout"] = relationship(back_populates="versions")
    tiles: Mapped[list["Tile"]] = relationship(back_populates="layout_version")
