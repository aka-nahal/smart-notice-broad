from pydantic import BaseModel, Field


_TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


class PeriodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    start_time: str = Field(pattern=_TIME_RE)
    end_time: str = Field(pattern=_TIME_RE)
    sort_order: int = 0


class PeriodUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    start_time: str | None = Field(default=None, pattern=_TIME_RE)
    end_time: str | None = Field(default=None, pattern=_TIME_RE)
    sort_order: int | None = None


class PeriodRead(BaseModel):
    id: int
    name: str
    start_time: str
    end_time: str
    sort_order: int

    model_config = {"from_attributes": True}
