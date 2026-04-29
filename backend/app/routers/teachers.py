from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.period import Period
from app.models.teacher import Teacher
from app.models.teacher_schedule import TeacherScheduleSlot
from app.models.timetable import TimetableEntry
from app.schemas.teacher import TeacherCreate, TeacherRead, TeacherUpdate
from app.schemas.teacher_schedule import ScheduleSlotRead, ScheduleSlotUpsert

router = APIRouter()


@router.get("", response_model=list[TeacherRead])
async def list_teachers(db: AsyncSession = Depends(get_db)) -> list[TeacherRead]:
    result = await db.execute(select(Teacher).order_by(Teacher.name))
    return [TeacherRead.model_validate(t) for t in result.scalars().all()]


@router.post("", response_model=TeacherRead)
async def create_teacher(body: TeacherCreate, db: AsyncSession = Depends(get_db)) -> TeacherRead:
    t = Teacher(**body.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return TeacherRead.model_validate(t)


def _entry_dict_from_slot(slot: TeacherScheduleSlot, period: Period) -> dict:
    return {
        "id":            slot.id,
        "timetable_id":  None,
        "period_number": period.sort_order or 0,
        "period_name":   period.name,
        "start_time":    period.start_time,
        "end_time":      period.end_time,
        "subject":       slot.subject or "",
        "room":          slot.room,
        "notes":         None,
    }


def _entry_dict_from_timetable(e: TimetableEntry) -> dict:
    return {
        "id":            e.id,
        "timetable_id":  e.timetable_id,
        "period_number": e.period_number,
        "period_name":   None,
        "start_time":    e.start_time,
        "end_time":      e.end_time,
        "subject":       e.subject,
        "room":          e.room,
        "notes":         e.notes,
    }


# NOTE: this literal route must precede /{teacher_id} so FastAPI doesn't try
# to coerce "now" as an int teacher_id (which 422s instead of falling through).
@router.get("/now")
async def get_all_teachers_now(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Batch resolver: current/next class for every teacher.

    Used by the teachers_list display tile so it can render N teachers in one
    HTTP round-trip instead of N polling requests.
    """
    now = datetime.now()
    today = now.weekday()
    now_str = now.strftime("%H:%M")

    teachers = (await db.execute(select(Teacher).order_by(Teacher.name))).scalars().all()

    slot_rows: list[tuple[TeacherScheduleSlot, Period]] = []
    if today <= 5:
        slot_rows = (
            await db.execute(
                select(TeacherScheduleSlot, Period)
                .join(Period, Period.id == TeacherScheduleSlot.period_id)
                .where(TeacherScheduleSlot.day_of_week == today)
                .order_by(Period.start_time)
            )
        ).all()

    slots_by_teacher: dict[int, list[tuple[TeacherScheduleSlot, Period]]] = {}
    for slot, period in slot_rows:
        slots_by_teacher.setdefault(slot.teacher_id, []).append((slot, period))

    legacy_rows = (
        await db.execute(
            select(TimetableEntry)
            .where(TimetableEntry.day_of_week == today)
            .order_by(TimetableEntry.start_time)
        )
    ).scalars().all()
    legacy_by_name: dict[str, list[TimetableEntry]] = {}
    for e in legacy_rows:
        if e.teacher:
            legacy_by_name.setdefault(e.teacher.lower(), []).append(e)

    result = []
    for t in teachers:
        current_entry = None
        next_entry = None

        for slot, period in slots_by_teacher.get(t.id, []):
            if period.start_time <= now_str < period.end_time:
                current_entry = _entry_dict_from_slot(slot, period)
                break
        if current_entry is None:
            for slot, period in slots_by_teacher.get(t.id, []):
                if period.start_time > now_str:
                    next_entry = _entry_dict_from_slot(slot, period)
                    break

        if current_entry is None and next_entry is None and t.name:
            for e in legacy_by_name.get(t.name.lower(), []):
                if e.start_time <= now_str < e.end_time:
                    current_entry = _entry_dict_from_timetable(e)
                    break
            if current_entry is None:
                for e in legacy_by_name.get(t.name.lower(), []):
                    if e.start_time > now_str:
                        next_entry = _entry_dict_from_timetable(e)
                        break

        result.append({
            "teacher_id":    t.id,
            "teacher_name":  t.name,
            "department":    t.department,
            "status":        t.status,
            "status_note":   t.status_note,
            "cabin":         t.room,
            "current_entry": current_entry,
            "next_entry":    next_entry,
            "server_time":   now_str,
        })
    return result


@router.get("/{teacher_id}", response_model=TeacherRead)
async def get_teacher(teacher_id: int, db: AsyncSession = Depends(get_db)) -> TeacherRead:
    t = await db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return TeacherRead.model_validate(t)


@router.patch("/{teacher_id}", response_model=TeacherRead)
async def update_teacher(
    teacher_id: int,
    body: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeacherRead:
    t = await db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    await db.commit()
    await db.refresh(t)
    return TeacherRead.model_validate(t)


@router.delete("/{teacher_id}")
async def delete_teacher(teacher_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    t = await db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    # SQLite doesn't enforce ON DELETE CASCADE without PRAGMA foreign_keys=ON,
    # so clear dependent rows explicitly.
    await db.execute(delete(TeacherScheduleSlot).where(TeacherScheduleSlot.teacher_id == teacher_id))
    await db.delete(t)
    await db.commit()
    return {"status": "ok"}


# ── Schedule grid ──────────────────────────────────────────────────────────────

@router.get("/{teacher_id}/schedule", response_model=list[ScheduleSlotRead])
async def list_teacher_schedule(
    teacher_id: int, db: AsyncSession = Depends(get_db)
) -> list[ScheduleSlotRead]:
    if not await db.get(Teacher, teacher_id):
        raise HTTPException(status_code=404, detail="Teacher not found")
    result = await db.execute(
        select(TeacherScheduleSlot).where(TeacherScheduleSlot.teacher_id == teacher_id)
    )
    return [ScheduleSlotRead.model_validate(s) for s in result.scalars().all()]


@router.put("/{teacher_id}/schedule", response_model=ScheduleSlotRead | None)
async def upsert_teacher_schedule_slot(
    teacher_id: int,
    body: ScheduleSlotUpsert,
    db: AsyncSession = Depends(get_db),
):
    """Upsert one (day, period) slot. If subject is empty/None and room empty/None,
    the slot is deleted instead."""
    if not await db.get(Teacher, teacher_id):
        raise HTTPException(status_code=404, detail="Teacher not found")
    if not await db.get(Period, body.period_id):
        raise HTTPException(status_code=404, detail="Period not found")

    result = await db.execute(
        select(TeacherScheduleSlot).where(
            TeacherScheduleSlot.teacher_id == teacher_id,
            TeacherScheduleSlot.day_of_week == body.day_of_week,
            TeacherScheduleSlot.period_id == body.period_id,
        )
    )
    existing = result.scalar_one_or_none()

    subject = (body.subject or "").strip() or None
    room = (body.room or "").strip() or None

    # Empty cell → delete it
    if subject is None and room is None:
        if existing:
            await db.delete(existing)
            await db.commit()
        return None

    if existing:
        existing.subject = subject
        existing.room = room
        slot = existing
    else:
        slot = TeacherScheduleSlot(
            teacher_id=teacher_id,
            day_of_week=body.day_of_week,
            period_id=body.period_id,
            subject=subject,
            room=room,
        )
        db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return ScheduleSlotRead.model_validate(slot)


@router.delete("/{teacher_id}/schedule/{slot_id}", status_code=204)
async def delete_schedule_slot(
    teacher_id: int, slot_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(
        select(TeacherScheduleSlot).where(
            TeacherScheduleSlot.id == slot_id,
            TeacherScheduleSlot.teacher_id == teacher_id,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Schedule slot not found")
    await db.delete(slot)
    await db.commit()


# ── Right-now resolver ────────────────────────────────────────────────────────


@router.get("/{teacher_id}/now")
async def get_teacher_now(
    teacher_id: int,
    timetable_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resolve a teacher's right-now state.

    Resolution order:
      1) Native schedule grid: TeacherScheduleSlot × Period for today.
      2) Legacy fallback: matching TimetableEntry rows by name.
      3) Cabin fallback: teacher.room.
    """
    teacher = await db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    now = datetime.now()
    today = now.weekday()  # 0=Mon … 6=Sun
    now_str = now.strftime("%H:%M")

    current_entry = None
    next_entry = None

    # 1) Native schedule grid
    if today <= 5:  # only Mon-Sat are configurable in the grid
        stmt = (
            select(TeacherScheduleSlot, Period)
            .join(Period, Period.id == TeacherScheduleSlot.period_id)
            .where(
                TeacherScheduleSlot.teacher_id == teacher_id,
                TeacherScheduleSlot.day_of_week == today,
            )
            .order_by(Period.start_time)
        )
        rows = (await db.execute(stmt)).all()

        def slot_to_entry(slot: TeacherScheduleSlot, period: Period) -> dict:
            return {
                "id":            slot.id,
                "timetable_id":  None,
                "period_number": period.sort_order or 0,
                "period_name":   period.name,
                "start_time":    period.start_time,
                "end_time":      period.end_time,
                "subject":       slot.subject or "",
                "room":          slot.room,
                "notes":         None,
            }

        for slot, period in rows:
            if period.start_time <= now_str < period.end_time:
                current_entry = slot_to_entry(slot, period)
                break
        if current_entry is None:
            for slot, period in rows:
                if period.start_time > now_str:
                    next_entry = slot_to_entry(slot, period)
                    break

    # 2) Legacy fallback via TimetableEntry by teacher name
    if current_entry is None and next_entry is None and teacher.name:
        stmt = (
            select(TimetableEntry)
            .where(
                TimetableEntry.day_of_week == today,
                func.lower(TimetableEntry.teacher) == teacher.name.lower(),
            )
            .order_by(TimetableEntry.start_time)
        )
        if timetable_id is not None:
            stmt = stmt.where(TimetableEntry.timetable_id == timetable_id)
        entries = (await db.execute(stmt)).scalars().all()

        def entry_to_dict(e: TimetableEntry) -> dict:
            return {
                "id":            e.id,
                "timetable_id":  e.timetable_id,
                "period_number": e.period_number,
                "period_name":   None,
                "start_time":    e.start_time,
                "end_time":      e.end_time,
                "subject":       e.subject,
                "room":          e.room,
                "notes":         e.notes,
            }

        for e in entries:
            if e.start_time <= now_str < e.end_time:
                current_entry = entry_to_dict(e)
                break
        if current_entry is None:
            for e in entries:
                if e.start_time > now_str:
                    next_entry = entry_to_dict(e)
                    break

    return {
        "teacher_id":    teacher.id,
        "teacher_name":  teacher.name,
        "status":        teacher.status,
        "status_note":   teacher.status_note,
        "cabin":         teacher.room,
        "current_entry": current_entry,
        "next_entry":    next_entry,
        "server_time":   now_str,
    }


@router.patch("/{teacher_id}/status", response_model=TeacherRead)
async def update_teacher_status(
    teacher_id: int,
    body: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeacherRead:
    """Quick status update endpoint."""
    t = await db.get(Teacher, teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if body.status is not None:
        t.status = body.status
    if body.status_note is not None:
        t.status_note = body.status_note
    await db.commit()
    await db.refresh(t)
    return TeacherRead.model_validate(t)
