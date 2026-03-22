from pydantic import BaseModel, Field


class NoticeDraftFromAI(BaseModel):
    title: str
    summary: str
    formatted_body: str
    priority_level: int = Field(ge=0, le=100, description="0 normal, higher more urgent")
    suggested_category: str | None = None
    suggested_tags: list[str] = Field(default_factory=list)
