"use client"

import { useCallback, useEffect, useState } from "react"

interface TimetableEntry {
  id: number
  period_number: number
  start_time: string
  end_time: string
  subject: string
  room: string | null
  teacher: string | null
  notes: string | null
  is_current: boolean
  is_past: boolean
}

interface Props {
  timetableId: number | string
  refreshSec?: number
  compact?: boolean
  showTeacher?: boolean
  showRoom?: boolean
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export function TimetableWidget({
  timetableId,
  refreshSec = 60,
  compact = false,
  showTeacher = true,
  showRoom = true,
}: Props) {
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [today] = useState(new Date().getDay())  // 0=Sun in JS, adjust below
  const todayIdx = today === 0 ? 6 : today - 1    // convert to 0=Mon

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/timetables/${timetableId}/today`)
      if (!res.ok) throw new Error(`${res.status}`)
      setEntries(await res.json())
      setError(null)
    } catch {
      setError("Timetable unavailable")
    } finally {
      setLoading(false)
    }
  }, [timetableId])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, refreshSec * 1000)
    return () => clearInterval(id)
  }, [fetchData, refreshSec])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
        <span className="text-lg">📅</span>
        <span className="text-xs text-red-400/70">{error}</span>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="text-xl">✅</span>
        <p className="text-sm font-medium text-zinc-300">No classes today</p>
        <p className="text-xs text-zinc-600">{DAY_NAMES[todayIdx]}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05]">
        <span className="text-sm">📅</span>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {DAY_NAMES[todayIdx]}
        </span>
        <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">
          {entries.length} period{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Periods */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`relative rounded-lg px-3 py-2 transition-all ${
              entry.is_current
                ? "bg-blue-500/20 border border-blue-500/40 shadow-blue-500/10 shadow-sm"
                : entry.is_past
                ? "opacity-50 bg-zinc-800/20"
                : "bg-zinc-800/40 border border-transparent"
            }`}
          >
            {entry.is_current && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4/5 bg-blue-400 rounded-full ml-0.5" />
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 pl-1">
                <p className={`font-semibold leading-tight truncate ${
                  compact ? "text-xs" : "text-sm"
                } ${entry.is_current ? "text-blue-100" : "text-zinc-200"}`}>
                  {entry.subject}
                </p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  {showRoom && entry.room && (
                    <span className={`text-zinc-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
                      📍 {entry.room}
                    </span>
                  )}
                  {showTeacher && entry.teacher && (
                    <span className={`text-zinc-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
                      👤 {entry.teacher}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`tabular-nums text-zinc-400 ${compact ? "text-[9px]" : "text-[10px]"}`}>
                  {entry.start_time}
                </p>
                <p className={`tabular-nums text-zinc-600 ${compact ? "text-[9px]" : "text-[10px]"}`}>
                  {entry.end_time}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
