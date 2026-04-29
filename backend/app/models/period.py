from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Period(Base):
    """A master bell-period (e.g. P1 = 09:00-09:45) shared across all teachers."""

    __tablename__ = "periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64))
    start_time: Mapped[str] = mapped_column(String(5))   # "09:00"
    end_time: Mapped[str] = mapped_column(String(5))     # "09:45"
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
