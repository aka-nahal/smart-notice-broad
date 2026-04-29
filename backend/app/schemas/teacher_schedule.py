from pydantic import BaseModel, Field


class ScheduleSlotUpsert(BaseModel):
    """Set or clear one cell of a teacher's grid. subject=None clears the slot."""

    day_of_week: int = Field(ge=0, le=5)
    period_id: int
    subject: str | None = None
    room: str | None = None


class ScheduleSlotRead(BaseModel):
    id: int
    teacher_id: int
    day_of_week: int
    period_id: int
    subject: str | None
    room: str | None

    model_config = {"from_attributes": True}
