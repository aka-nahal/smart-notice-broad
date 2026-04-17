from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.timetable import Timetable, TimetableEntry

router = APIRouter()

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Timetables ────────────────────────────────────────────────────────────────

@router.get("")
async def list_timetables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Timetable)
        .options(selectinload(Timetable.entries))
        .order_by(Timetable.name)
    )
    return result.scalars().all()


@router.post("", status_code=201)
async def create_timetable(data: dict, db: AsyncSession = Depends(get_db)):
    timetable = Timetable(
        name=data.get("name", "Untitled Timetable"),
        description=data.get("description"),
    )
    db.add(timetable)
    await db.commit()
    await db.refresh(timetable)
    return timetable


@router.get("/{timetable_id}")
async def get_timetable(timetable_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Timetable)
        .options(selectinload(Timetable.entries))
        .where(Timetable.id == timetable_id)
    )
    timetable = result.scalar_one_or_none()
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return timetable


@router.patch("/{timetable_id}")
async def update_timetable(timetable_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Timetable).where(Timetable.id == timetable_id))
    timetable = result.scalar_one_or_none()
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")
    if "name" in data:
        timetable.name = data["name"]
    if "description" in data:
        timetable.description = data["description"]
    await db.commit()
    await db.refresh(timetable)
    return timetable


@router.delete("/{timetable_id}", status_code=204)
async def delete_timetable(timetable_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Timetable).where(Timetable.id == timetable_id))
    timetable = result.scalar_one_or_none()
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")
    await db.delete(timetable)
    await db.commit()


# ── Today's schedule ──────────────────────────────────────────────────────────

@router.get("/{timetable_id}/today")
async def get_today(timetable_id: int, db: AsyncSession = Depends(get_db)):
    today = datetime.now().weekday()  # 0=Mon
    result = await db.execute(
        select(TimetableEntry)
        .where(
            TimetableEntry.timetable_id == timetable_id,
            TimetableEntry.day_of_week == today,
        )
        .order_by(TimetableEntry.start_time)
    )
    entries = result.scalars().all()
    now_str = datetime.now().strftime("%H:%M")
    return [
        {
            "id":            e.id,
            "period_number": e.period_number,
            "start_time":    e.start_time,
            "end_time":      e.end_time,
            "subject":       e.subject,
            "room":          e.room,
            "teacher":       e.teacher,
            "notes":         e.notes,
            "is_current":    e.start_time <= now_str < e.end_time,
            "is_past":       e.end_time <= now_str,
        }
        for e in entries
    ]


# ── Entries CRUD ──────────────────────────────────────────────────────────────

@router.post("/{timetable_id}/entries", status_code=201)
async def add_entry(timetable_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    # Verify parent exists
    result = await db.execute(select(Timetable).where(Timetable.id == timetable_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Timetable not found")

    entry = TimetableEntry(
        timetable_id=timetable_id,
        day_of_week=int(data["day_of_week"]),
        period_number=int(data.get("period_number", 1)),
        start_time=data["start_time"],
        end_time=data["end_time"],
        subject=data["subject"],
        room=data.get("room"),
        teacher=data.get("teacher"),
        notes=data.get("notes"),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{timetable_id}/entries/{entry_id}", status_code=204)
async def delete_entry(timetable_id: int, entry_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == entry_id,
            TimetableEntry.timetable_id == timetable_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
