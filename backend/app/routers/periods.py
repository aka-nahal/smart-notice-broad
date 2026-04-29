from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.period import Period
from app.models.teacher_schedule import TeacherScheduleSlot
from app.schemas.period import PeriodCreate, PeriodRead, PeriodUpdate

router = APIRouter()


@router.get("", response_model=list[PeriodRead])
async def list_periods(db: AsyncSession = Depends(get_db)) -> list[PeriodRead]:
    result = await db.execute(
        select(Period).order_by(Period.sort_order, Period.start_time)
    )
    return [PeriodRead.model_validate(p) for p in result.scalars().all()]


@router.post("", response_model=PeriodRead, status_code=201)
async def create_period(body: PeriodCreate, db: AsyncSession = Depends(get_db)) -> PeriodRead:
    if body.start_time >= body.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")
    p = Period(**body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return PeriodRead.model_validate(p)


@router.patch("/{period_id}", response_model=PeriodRead)
async def update_period(
    period_id: int, body: PeriodUpdate, db: AsyncSession = Depends(get_db)
) -> PeriodRead:
    p = await db.get(Period, period_id)
    if not p:
        raise HTTPException(status_code=404, detail="Period not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    if p.start_time >= p.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")
    await db.commit()
    await db.refresh(p)
    return PeriodRead.model_validate(p)


@router.delete("/{period_id}", status_code=204)
async def delete_period(period_id: int, db: AsyncSession = Depends(get_db)) -> None:
    p = await db.get(Period, period_id)
    if not p:
        raise HTTPException(status_code=404, detail="Period not found")
    # SQLite doesn't enforce ON DELETE CASCADE without PRAGMA foreign_keys=ON,
    # so clear dependent rows explicitly.
    await db.execute(delete(TeacherScheduleSlot).where(TeacherScheduleSlot.period_id == period_id))
    await db.delete(p)
    await db.commit()
