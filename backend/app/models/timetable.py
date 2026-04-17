from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Timetable(Base):
    __tablename__ = "timetables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="timetable", cascade="all, delete-orphan", order_by="TimetableEntry.day_of_week, TimetableEntry.start_time"
    )


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timetable_id: Mapped[int] = mapped_column(ForeignKey("timetables.id"), index=True)
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0=Mon … 6=Sun
    period_number: Mapped[int] = mapped_column(Integer, default=1)
    start_time: Mapped[str] = mapped_column(String(5))   # "09:00"
    end_time: Mapped[str] = mapped_column(String(5))     # "10:00"
    subject: Mapped[str] = mapped_column(String(256))
    room: Mapped[str | None] = mapped_column(String(64), nullable=True)
    teacher: Mapped[str | None] = mapped_column(String(256), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    timetable: Mapped["Timetable"] = relationship(back_populates="entries")
