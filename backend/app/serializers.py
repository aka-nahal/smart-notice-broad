import json

from app.models.notice import Notice
from app.schemas.notice import NoticeRead


def notice_to_read(notice: Notice) -> NoticeRead:
    tags: list[str] = []
    if notice.tags_json:
        try:
            parsed = json.loads(notice.tags_json)
            if isinstance(parsed, list):
                tags = [str(t) for t in parsed]
        except (json.JSONDecodeError, TypeError):
            tags = []
    return NoticeRead(
        id=notice.id,
        title=notice.title,
        body=notice.body,
        summary=notice.summary,
        category=notice.category,
        tags=tags,
        priority=notice.priority,
        locale=notice.locale,
        created_at=notice.created_at,
        updated_at=notice.updated_at,
        ai_metadata_json=notice.ai_metadata_json,
    )
