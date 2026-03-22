from datetime import datetime

from pydantic import BaseModel, Field


class NoticeCreate(BaseModel):
    title: str = ""
    body: str = ""
    summary: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    priority: int = 0
    locale: str = "en"


class NoticeUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    summary: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    priority: int | None = None
    locale: str | None = None


class NoticeRead(BaseModel):
    id: int
    title: str
    body: str
    summary: str | None
    category: str | None
    tags: list[str]
    priority: int
    locale: str
    created_at: datetime
    updated_at: datetime
    ai_metadata_json: str | None = None

    model_config = {"from_attributes": True}
