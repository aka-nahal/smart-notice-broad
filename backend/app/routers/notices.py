import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notice import Notice
from app.schemas.notice import NoticeCreate, NoticeRead, NoticeUpdate
from app.serializers import notice_to_read

router = APIRouter()


@router.get("", response_model=list[NoticeRead])
async def list_notices(db: AsyncSession = Depends(get_db)) -> list[NoticeRead]:
    result = await db.execute(select(Notice).order_by(Notice.updated_at.desc()))
    rows = result.scalars().all()
    return [notice_to_read(n) for n in rows]


@router.post("", response_model=NoticeRead)
async def create_notice(body: NoticeCreate, db: AsyncSession = Depends(get_db)) -> NoticeRead:
    n = Notice(
        title=body.title,
        body=body.body,
        summary=body.summary,
        category=body.category,
        tags_json=json.dumps(body.tags) if body.tags else None,
        priority=body.priority,
        locale=body.locale,
    )
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return notice_to_read(n)


@router.get("/{notice_id}", response_model=NoticeRead)
async def get_notice(notice_id: int, db: AsyncSession = Depends(get_db)) -> NoticeRead:
    n = await db.get(Notice, notice_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice_to_read(n)


@router.patch("/{notice_id}", response_model=NoticeRead)
async def update_notice(
    notice_id: int,
    body: NoticeUpdate,
    db: AsyncSession = Depends(get_db),
) -> NoticeRead:
    n = await db.get(Notice, notice_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notice not found")
    data = body.model_dump(exclude_unset=True)
    if "tags" in data:
        tags = data.pop("tags")
        n.tags_json = json.dumps(tags) if tags else None
    for k, v in data.items():
        setattr(n, k, v)
    await db.commit()
    await db.refresh(n)
    return notice_to_read(n)


@router.delete("/{notice_id}")
async def delete_notice(notice_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    n = await db.get(Notice, notice_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notice not found")
    await db.delete(n)
    await db.commit()
    return {"status": "ok"}
