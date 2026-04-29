"use client"

import { useCallback, useEffect, useState } from "react"

interface CurrentEntry {
  id: number
  timetable_id: number
  period_number: number
  start_time: string
  end_time: string
  subject: string
  room: string | null
  notes: string | null
}

interface TeacherNow {
  teacher_id: number
  teacher_name: string
  status: string
  status_note: string | null
  cabin: string | null
  current_entry: CurrentEntry | null
  next_entry: CurrentEntry | null
  server_time: string
}

interface Props {
  teacherId: number | string
  timetableId?: number | string
  refreshSec?: number
  compact?: boolean
}

export function TeacherStatusWidget({
  teacherId,
  timetableId,
  refreshSec = 60,
  compact = false,
}: Props) {
  const [data, setData] = useState<TeacherNow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const qs = timetableId ? `?timetable_id=${timetableId}` : ""
      const res = await fetch(`/api/teachers/${teacherId}/now${qs}`)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
      setError(null)
    } catch {
      setError("Status unavailable")
    } finally {
      setLoading(false)
    }
  }, [teacherId, timetableId])

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

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
        <span className="text-lg">👤</span>
        <span className="text-xs text-red-400/70">{error ?? "No data"}</span>
      </div>
    )
  }

  const inClass = !!data.current_entry
  const e = data.current_entry

  // Sizing
  const nameCls   = compact ? "text-xs"  : "text-sm"
  const headCls   = compact ? "text-base" : "text-lg"
  const labelCls  = compact ? "text-[9px]"  : "text-[10px]"
  const valueCls  = compact ? "text-sm"  : "text-base"

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05]">
        <span className={headCls}>{inClass ? "📚" : "🏛️"}</span>
        <span className={`font-semibold text-zinc-200 truncate ${nameCls}`}>
          {data.teacher_name || "Teacher"}
        </span>
        <span className="ml-auto tabular-nums text-[10px] text-zinc-600">
          {data.server_time}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center px-4 py-3 gap-1">
        {inClass ? (
          <>
            <span className={`uppercase tracking-widest text-blue-400/80 font-semibold ${labelCls}`}>
              Now teaching
            </span>
            <p className={`font-bold text-blue-100 leading-tight ${valueCls}`}>
              {e!.subject}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-zinc-400">
              {e!.room && (
                <span className={labelCls}>📍 {e!.room}</span>
              )}
              <span className={labelCls}>P{e!.period_number}</span>
              <span className={`tabular-nums ${labelCls}`}>
                {e!.start_time}–{e!.end_time}
              </span>
            </div>
          </>
        ) : (
          <>
            <span className={`uppercase tracking-widest text-emerald-400/80 font-semibold ${labelCls}`}>
              Available · in cabin
            </span>
            <p className={`font-bold text-zinc-100 leading-tight ${valueCls}`}>
              {data.cabin || "Cabin not set"}
            </p>
            {data.next_entry && (
              <p className={`mt-1 text-zinc-500 ${labelCls}`}>
                Next: {data.next_entry.subject} at {data.next_entry.start_time}
                {data.next_entry.room ? ` · ${data.next_entry.room}` : ""}
              </p>
            )}
            {!data.next_entry && (
              <p className={`mt-1 text-zinc-600 ${labelCls}`}>
                No more classes today
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
