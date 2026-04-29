import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.app_setting import AppSetting

router = APIRouter()


@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db)) -> dict:
    s = await db.get(AppSetting, key)
    if not s:
        return {"key": key, "value": None}
    try:
        value = json.loads(s.value) if s.value else None
    except json.JSONDecodeError:
        value = s.value
    return {"key": key, "value": value}


@router.put("/{key}")
async def put_setting(key: str, body: dict, db: AsyncSession = Depends(get_db)) -> dict:
    if "value" not in body:
        raise HTTPException(status_code=400, detail="Body must contain 'value'")
    payload = json.dumps(body["value"])
    s = await db.get(AppSetting, key)
    if s:
        s.value = payload
    else:
        s = AppSetting(key=key, value=payload)
        db.add(s)
    await db.commit()
    return {"key": key, "value": body["value"]}
