from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TeacherScheduleSlot(Base):
    """One cell in a teacher's weekly grid: (day, period) -> subject/room."""

    __tablename__ = "teacher_schedule_slots"
    __table_args__ = (
        UniqueConstraint("teacher_id", "day_of_week", "period_id", name="uq_teacher_day_period"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), index=True)
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0=Mon … 5=Sat
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str | None] = mapped_column(String(256), nullable=True)
    room: Mapped[str | None] = mapped_column(String(64), nullable=True)
