"use client"

import { useEffect, useMemo, useState } from "react"
import { TeacherStatusWidget } from "@/components/teacher-status-widget"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

interface TeacherLite {
  id: number
  name: string
  room: string | null
}

interface TimetableEntry {
  id: number
  day_of_week: number
  period_number: number
  start_time: string
  end_time: string
  subject: string
  room: string | null
  teacher: string | null
  notes: string | null
}

interface Timetable {
  id: number
  name: string
  description: string | null
  entries: TimetableEntry[]
}

const EMPTY_ENTRY = {
  day_of_week: 0,
  period_number: 1,
  start_time: "09:00",
  end_time: "10:00",
  subject: "",
  room: "",
  teacher: "",
  notes: "",
}

export default function TimetablesPage() {
  const [timetables, setTimetables] = useState<Timetable[]>([])
  const [selected, setSelected] = useState<Timetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(0)
  const [showNewTT, setShowNewTT] = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [newTTName, setNewTTName] = useState("")
  const [newTTDesc, setNewTTDesc] = useState("")
  const [newEntry, setNewEntry] = useState({ ...EMPTY_ENTRY })
  const [saving, setSaving] = useState(false)
  const [teachers, setTeachers] = useState<TeacherLite[]>([])

  useEffect(() => {
    let cancelled = false
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((data) => { if (!cancelled && Array.isArray(data)) setTeachers(data) })
      .catch(() => { /* leave empty */ })
    return () => { cancelled = true }
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const res = await fetch("/api/timetables")
      const data = await res.json()
      setTimetables(data)
      if (selected) {
        const updated = data.find((t: Timetable) => t.id === selected.id)
        setSelected(updated ?? null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line

  async function createTimetable() {
    if (!newTTName.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/timetables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTTName.trim(), description: newTTDesc.trim() || null }),
      })
      const created = await res.json()
      await loadAll()
      setSelected(created)
      setNewTTName("")
      setNewTTDesc("")
      setShowNewTT(false)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTimetable(id: number) {
    if (!confirm("Delete this timetable and all its entries?")) return
    await fetch(`/api/timetables/${id}`, { method: "DELETE" })
    if (selected?.id === id) setSelected(null)
    await loadAll()
  }

  async function addEntry() {
    if (!selected || !newEntry.subject.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/timetables/${selected.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newEntry,
          subject: newEntry.subject.trim(),
          room: newEntry.room?.trim() || null,
          teacher: newEntry.teacher?.trim() || null,
          notes: newEntry.notes?.trim() || null,
        }),
      })
      await loadAll()
      setNewEntry({ ...EMPTY_ENTRY, day_of_week: activeDay })
      setShowNewEntry(false)
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(entryId: number) {
    if (!selected) return
    await fetch(`/api/timetables/${selected.id}/entries/${entryId}`, { method: "DELETE" })
    await loadAll()
  }

  const dayEntries = selected?.entries.filter((e) => e.day_of_week === activeDay) ?? []

  // Distinct teacher names referenced by the selected timetable, matched
  // case-insensitively to the teachers list so we can render live-status tiles.
  const liveTeachers = useMemo(() => {
    if (!selected) return [] as { id: number; name: string }[]
    const namesLower = new Set<string>()
    for (const e of selected.entries) {
      const n = e.teacher?.trim()
      if (n) namesLower.add(n.toLowerCase())
    }
    const matched: { id: number; name: string }[] = []
    const seen = new Set<number>()
    for (const t of teachers) {
      if (namesLower.has(t.name.trim().toLowerCase()) && !seen.has(t.id)) {
        matched.push({ id: t.id, name: t.name })
        seen.add(t.id)
      }
    }
    return matched.sort((a, b) => a.name.localeCompare(b.name))
  }, [selected, teachers])

  return (
    <div className="flex h-full">
      {/* Sidebar — timetable list */}
      <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-white/30 dark:bg-zinc-900/30 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Timetables</h2>
          <button
            onClick={() => setShowNewTT(true)}
            className="rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
          >
            + New
          </button>
        </div>

        {showNewTT && (
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50 space-y-2">
            <input
              autoFocus
              value={newTTName}
              onChange={(e) => setNewTTName(e.target.value)}
              placeholder="Name"
              className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
            />
            <input
              value={newTTDesc}
              onChange={(e) => setNewTTDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
            />
            <div className="flex gap-2">
              <button
                onClick={createTimetable} disabled={saving || !newTTName.trim()}
                className="flex-1 rounded bg-blue-500 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Create
              </button>
              <button onClick={() => setShowNewTT(false)} className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 py-4">Loading…</p>
          ) : timetables.length === 0 ? (
            <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 py-4">No timetables yet.</p>
          ) : (
            timetables.map((tt) => (
              <div
                key={tt.id}
                onClick={() => setSelected(tt)}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  selected?.id === tt.id
                    ? "bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-transparent"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tt.name}</p>
                  <p className="text-[10px] text-zinc-600 dark:text-zinc-400">{tt.entries.length} entries</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTimetable(tt.id) }}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-red-400 hover:text-red-300 text-xs"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-zinc-600 dark:text-zinc-400 flex-col gap-2">
            <span className="text-4xl">📅</span>
            <p className="text-sm">Select a timetable to edit</p>
          </div>
        ) : (
          <div className="px-6 py-6 max-w-3xl">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-900 dark:text-zinc-100">{selected.name}</h1>
              {selected.description && (
                <p className="text-sm text-zinc-500 mt-0.5">{selected.description}</p>
              )}
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Tile ID to use in builder config: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-zinc-600 dark:text-zinc-700 dark:text-zinc-300">{selected.id}</code>
              </p>
            </div>

            {/* Live teacher status — current class or cabin fallback */}
            <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-white/40 dark:bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📡</span>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-600 dark:text-zinc-400">
                  Live teacher status
                </h2>
                <span className="ml-auto text-[10px] text-zinc-600 dark:text-zinc-400">
                  {liveTeachers.length} teacher{liveTeachers.length === 1 ? "" : "s"} · today
                </span>
              </div>
              {liveTeachers.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  No teachers in this timetable match a teacher record. Add entries with a teacher
                  name that exists in <a href="/admin/teachers" className="text-blue-500 hover:underline">/admin/teachers</a>.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {liveTeachers.map((t) => (
                    <div
                      key={t.id}
                      className="h-28 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
                    >
                      <TeacherStatusWidget
                        teacherId={t.id}
                        timetableId={selected.id}
                        compact
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Day tabs */}
            <div className="flex gap-1 mb-4 overflow-x-auto">
              {DAY_NAMES.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => { setActiveDay(idx); setShowNewEntry(false) }}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeDay === idx
                      ? "bg-blue-500 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {day.slice(0, 3)}
                  {selected.entries.filter((e) => e.day_of_week === idx).length > 0 && (
                    <span className="ml-1 text-[9px] opacity-70">
                      {selected.entries.filter((e) => e.day_of_week === idx).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Entries for active day */}
            <div className="space-y-2 mb-4">
              {dayEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">No periods for {DAY_NAMES[activeDay]}</p>
                </div>
              ) : (
                dayEntries
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-4 py-3"
                    >
                      <div className="text-center shrink-0 w-14">
                        <p className="text-xs font-mono text-zinc-500">{entry.start_time}</p>
                        <p className="text-[10px] text-zinc-700 dark:text-zinc-600 dark:text-zinc-400 font-mono">{entry.end_time}</p>
                      </div>
                      <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-900 dark:text-zinc-100 truncate">{entry.subject}</p>
                        <div className="flex gap-3 text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {entry.room && <span>📍 {entry.room}</span>}
                          {entry.teacher && <span>👤 {entry.teacher}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                        P{entry.period_number}
                      </span>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Add entry */}
            {showNewEntry ? (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-white/50 dark:bg-zinc-900/50 p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Add period — {DAY_NAMES[activeDay]}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Subject *</label>
                    <input
                      autoFocus
                      value={newEntry.subject}
                      onChange={(e) => setNewEntry({ ...newEntry, subject: e.target.value })}
                      placeholder="Mathematics"
                      className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Period #</label>
                    <input
                      type="number" min={1} max={12}
                      value={newEntry.period_number}
                      onChange={(e) => setNewEntry({ ...newEntry, period_number: parseInt(e.target.value) || 1 })}
                      className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Start time</label>
                    <input
                      type="time"
                      value={newEntry.start_time}
                      onChange={(e) => setNewEntry({ ...newEntry, start_time: e.target.value })}
                      className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">End time</label>
                    <input
                      type="time"
                      value={newEntry.end_time}
                      onChange={(e) => setNewEntry({ ...newEntry, end_time: e.target.value })}
                      className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Room</label>
                    <input
                      value={newEntry.room}
                      onChange={(e) => setNewEntry({ ...newEntry, room: e.target.value })}
                      placeholder="Room 101"
                      className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Teacher</label>
                    <input
                      value={newEntry.teacher}
                      onChange={(e) => setNewEntry({ ...newEntry, teacher: e.target.value })}
                      placeholder="Mr. Smith"
                      className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={addEntry} disabled={saving || !newEntry.subject.trim()}
                    className="rounded bg-blue-500 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-blue-600"
                  >
                    Add Period
                  </button>
                  <button
                    onClick={() => setShowNewEntry(false)}
                    className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setNewEntry({ ...EMPTY_ENTRY, day_of_week: activeDay }); setShowNewEntry(true) }}
                className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-500 dark:hover:text-blue-400 w-full justify-center transition-colors"
              >
                + Add period to {DAY_NAMES[activeDay]}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
