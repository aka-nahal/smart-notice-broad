"use client"

import { useEffect, useMemo, useState } from "react"
import api from "@/lib/api-client"
import {
  TEACHER_STATUSES,
  WEEKDAY_NAMES,
  type PeriodRead,
  type ScheduleSlotRead,
  type TeacherCreate,
  type TeacherRead,
  type TeacherStatus,
} from "@/lib/types"

function statusInfo(status: TeacherStatus) {
  return TEACHER_STATUSES.find((s) => s.value === status) ?? TEACHER_STATUSES[4]
}

function StatusDot({ status }: { status: TeacherStatus }) {
  const info = statusInfo(status)
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    blue: "bg-blue-400",
    violet: "bg-violet-400",
    red: "bg-red-400",
  }
  return <span className={`h-1.5 w-1.5 rounded-full ${colorMap[info.color] ?? "bg-zinc-500"}`} />
}

export function TeachersTab() {
  const [teachers, setTeachers] = useState<TeacherRead[]>([])
  const [periods, setPeriods] = useState<PeriodRead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TeacherCreate>({ name: "", department: "" })
  const [busy, setBusy] = useState(false)

  async function loadAll() {
    setLoading(true)
    try {
      const [t, p] = await Promise.all([api.teachers.list(), api.periods.list()])
      setTeachers(t)
      setPeriods(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function createTeacher() {
    if (!form.name.trim()) return
    setBusy(true)
    try {
      const created = await api.teachers.create({ ...form, name: form.name.trim() })
      await loadAll()
      setShowCreate(false)
      setForm({ name: "", department: "" })
      setSelectedId(created.id)
    } catch (e) {
      console.error("Create failed", e)
    } finally {
      setBusy(false)
    }
  }

  async function deleteTeacher(id: number) {
    if (!confirm("Delete this teacher and their schedule?")) return
    await api.teachers.delete(id)
    if (selectedId === id) setSelectedId(null)
    await loadAll()
  }

  const filtered = useMemo(() => {
    if (!search) return teachers
    const q = search.toLowerCase()
    return teachers.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q) ||
      (t.subject ?? "").toLowerCase().includes(q) ||
      (t.room ?? "").toLowerCase().includes(q)
    )
  }, [teachers, search])

  const selected = teachers.find((t) => t.id === selectedId) ?? null

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left column: teacher list */}
      <div className="col-span-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-zinc-100">Teachers</h2>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            {showCreate ? "Cancel" : "+ Add"}
          </button>
        </div>

        {showCreate && (
          <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name *"
              className="w-full rounded bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700 focus:border-blue-500/50"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.department ?? ""}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Department"
                className="rounded bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700 focus:border-blue-500/50"
              />
              <input
                value={form.room ?? ""}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder="Cabin / Room"
                className="rounded bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700 focus:border-blue-500/50"
              />
            </div>
            <button
              onClick={createTeacher} disabled={!form.name.trim() || busy}
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-blue-500"
            >
              Create teacher
            </button>
          </div>
        )}

        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teachers…"
          className="w-full mb-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none border border-zinc-800 focus:border-blue-500/40"
        />

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
            {teachers.length === 0 ? "No teachers yet." : "No matches."}
          </div>
        ) : (
          <ul className="space-y-1 max-h-[64vh] overflow-y-auto pr-1">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={`group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                    selectedId === t.id
                      ? "bg-blue-500/10 border border-blue-500/30 text-blue-200"
                      : "hover:bg-zinc-800/50 text-zinc-300 border border-transparent"
                  }`}
                >
                  <StatusDot status={t.status as TeacherStatus} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {t.department || "—"}{t.room ? ` · ${t.room}` : ""}
                    </p>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteTeacher(t.id) }}
                    role="button"
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-1"
                    title="Delete teacher"
                  >
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right column: schedule editor */}
      <div className="col-span-8">
        {selected == null ? (
          <div className="flex h-[60vh] items-center justify-center rounded-xl border border-dashed border-zinc-800 text-zinc-500 flex-col gap-2">
            <span className="text-3xl">🗂️</span>
            <p className="text-sm">Select a teacher to edit their weekly schedule</p>
          </div>
        ) : periods.length === 0 ? (
          <div className="flex h-[60vh] items-center justify-center rounded-xl border border-dashed border-zinc-800 text-zinc-500 flex-col gap-2 text-center px-4">
            <span className="text-3xl">⏰</span>
            <p className="text-sm">No periods defined yet.</p>
            <p className="text-xs text-zinc-600">Switch to the Periods tab and add at least one period first.</p>
          </div>
        ) : (
          <ScheduleEditor teacher={selected} periods={periods} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule editor — Mon-Sat × periods grid
// ---------------------------------------------------------------------------

function ScheduleEditor({ teacher, periods }: { teacher: TeacherRead; periods: PeriodRead[] }) {
  const [slots, setSlots] = useState<ScheduleSlotRead[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ day: number; periodId: number } | null>(null)
  const [draft, setDraft] = useState<{ subject: string; room: string }>({ subject: "", room: "" })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setSlots(await api.teachers.schedule(teacher.id))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [teacher.id]) // eslint-disable-line

  function getSlot(day: number, periodId: number) {
    return slots.find((s) => s.day_of_week === day && s.period_id === periodId)
  }

  function startEdit(day: number, periodId: number) {
    const existing = getSlot(day, periodId)
    setDraft({ subject: existing?.subject ?? "", room: existing?.room ?? "" })
    setEditing({ day, periodId })
  }

  async function save() {
    if (!editing) return
    setBusy(true)
    try {
      await api.teachers.upsertSlot(teacher.id, {
        day_of_week: editing.day,
        period_id: editing.periodId,
        subject: draft.subject,
        room: draft.room,
      })
      await load()
      setEditing(null)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  async function clearCell() {
    if (!editing) return
    setBusy(true)
    try {
      await api.teachers.upsertSlot(teacher.id, {
        day_of_week: editing.day,
        period_id: editing.periodId,
        subject: null,
        room: null,
      })
      await load()
      setEditing(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{teacher.name}</h3>
          <p className="text-xs text-zinc-500">
            Click any cell to assign a subject + room for that day & period.
          </p>
        </div>
        {loading && (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-zinc-900/60 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 text-left w-28 border-b border-zinc-800">Period</th>
              {WEEKDAY_NAMES.map((d) => (
                <th key={d} className="px-3 py-2 text-left border-b border-zinc-800">{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50">
                <td className="px-3 py-2 align-top">
                  <p className="text-xs font-semibold text-zinc-300">{p.name}</p>
                  <p className="text-[10px] font-mono text-zinc-500">{p.start_time}–{p.end_time}</p>
                </td>
                {WEEKDAY_NAMES.map((_, dayIdx) => {
                  const slot = getSlot(dayIdx, p.id)
                  return (
                    <td key={dayIdx} className="px-1 py-1 align-top w-1/6">
                      <button
                        onClick={() => startEdit(dayIdx, p.id)}
                        className={`block w-full min-h-[58px] rounded-md px-2 py-1.5 text-left transition-colors ${
                          slot
                            ? "bg-blue-900/30 border border-blue-500/30 hover:bg-blue-900/50"
                            : "border border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/40"
                        }`}
                      >
                        {slot ? (
                          <>
                            <p className="text-xs font-medium text-blue-200 truncate">{slot.subject ?? "(no subject)"}</p>
                            {slot.room && (
                              <p className="text-[10px] text-blue-400/70 truncate">📍 {slot.room}</p>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-600">＋</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor popover */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setEditing(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
          >
            <h4 className="text-sm font-semibold text-zinc-200 mb-1">
              {WEEKDAY_NAMES[editing.day]} · {periods.find((p) => p.id === editing.periodId)?.name}
            </h4>
            <p className="text-[11px] text-zinc-500 mb-4">
              {periods.find((p) => p.id === editing.periodId)?.start_time}
              –{periods.find((p) => p.id === editing.periodId)?.end_time}
            </p>

            <label className="block mb-3">
              <span className="block text-[10px] text-zinc-500 mb-1">Subject</span>
              <input
                autoFocus value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Mathematics"
                className="w-full rounded bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700 focus:border-blue-500/50"
              />
            </label>
            <label className="block mb-4">
              <span className="block text-[10px] text-zinc-500 mb-1">Room</span>
              <input
                value={draft.room}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                placeholder="B-204"
                className="w-full rounded bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700 focus:border-blue-500/50"
              />
            </label>

            <div className="flex gap-2">
              <button
                onClick={save} disabled={busy}
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-500"
              >
                Save
              </button>
              <button
                onClick={clearCell} disabled={busy}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20 hover:border-red-500/30"
              >
                Clear
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
