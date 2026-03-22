import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notice import Notice
from app.schemas.ai import NoticeDraftFromAI
from app.schemas.notice import NoticeRead
from app.serializers import notice_to_read
from app.services.gemini import draft_notice_from_raw_input

router = APIRouter()


class RawNoticeRequest(BaseModel):
    raw_text: str = Field(min_length=1)
    locale: str = "en"
    persist: bool = False


class RawNoticeResponse(BaseModel):
    draft: NoticeDraftFromAI
    notice: NoticeRead | None = None


@router.post("/draft-notice", response_model=RawNoticeResponse)
async def ai_draft_notice(
    body: RawNoticeRequest,
    db: AsyncSession = Depends(get_db),
) -> RawNoticeResponse:
    try:
        draft = await draft_notice_from_raw_input(raw_text=body.raw_text, locale=body.locale)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e!s}") from e

    notice_read: NoticeRead | None = None
    if body.persist:
        meta = {"source": "gemini", "raw_input": body.raw_text[:2000]}
        n = Notice(
            title=draft.title,
            body=draft.formatted_body,
            summary=draft.summary,
            category=draft.suggested_category,
            tags_json=json.dumps(draft.suggested_tags) if draft.suggested_tags else None,
            priority=min(100, max(0, draft.priority_level)),
            locale=body.locale,
            ai_metadata_json=json.dumps(meta),
        )
        db.add(n)
        await db.commit()
        await db.refresh(n)
        notice_read = notice_to_read(n)

    return RawNoticeResponse(draft=draft, notice=notice_read)
