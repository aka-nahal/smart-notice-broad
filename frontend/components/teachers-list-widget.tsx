"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_TEACHER_DISPLAY,
  TEACHER_DISPLAY_SETTINGS_KEY,
  TEACHER_STATUSES,
  type TeacherDisplaySettings,
  type TeacherStatus,
} from "@/lib/types"

interface TeacherNowEntry {
  id: number
  period_number: number
  period_name: string | null
  start_time: string
  end_time: string
  subject: string
  room: string | null
  notes: string | null
}

interface TeacherNow {
  teacher_id: number
  teacher_name: string
  department: string
  status: TeacherStatus
  status_note: string | null
  cabin: string | null
  current_entry: TeacherNowEntry | null
  next_entry: TeacherNowEntry | null
  server_time: string
}

interface Props {
  filter?: "all" | "available" | "in_class" | "busy" | string
  scrollSpeed?: number          // px/sec; 0 disables auto-scroll
  showAvatar?: boolean
  title?: string
  refreshSec?: number
}

const DEFAULT_REFRESH = 60

function statusInfo(status: TeacherStatus) {
  return TEACHER_STATUSES.find((s) => s.value === status) ?? TEACHER_STATUSES[4]
}

function formatTime(t: string, fmt: "12h" | "24h"): string {
  if (fmt === "24h") return t
  const [h, m] = t.split(":").map(Number)
  if (Number.isNaN(h)) return t
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = ((h + 11) % 12) + 1
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

export function TeachersListWidget({
  filter = "all",
  scrollSpeed = 25,
  showAvatar = true,
  title = "Teachers",
  refreshSec = DEFAULT_REFRESH,
}: Props) {
  const [data, setData] = useState<TeacherNow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [display, setDisplay] = useState<TeacherDisplaySettings>(DEFAULT_TEACHER_DISPLAY)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers/now", { cache: "no-store" })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
      setError(null)
    } catch {
      setError("unavailable")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load display-format settings once. We don't refetch on tick — settings
  // change rarely and aren't worth the request rate.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/settings/${encodeURIComponent(TEACHER_DISPLAY_SETTINGS_KEY)}`)
      .then((r) => r.json())
      .then((r) => {
        if (cancelled) return
        if (r?.value) setDisplay({ ...DEFAULT_TEACHER_DISPLAY, ...r.value })
      })
      .catch(() => { /* fall back to defaults */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, refreshSec * 1000)
    return () => clearInterval(id)
  }, [fetchAll, refreshSec])

  // Filter teachers per tile config
  const filtered = useMemo(() => {
    const arr = filter === "all"
      ? data
      : data.filter((t) => {
          if (filter === "available") return !t.current_entry  // free right now
          if (filter === "in_class")  return !!t.current_entry
          return t.status === filter
        })
    return arr.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name))
  }, [data, filter])

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.05] shrink-0">
          <span className="text-sm">👥</span>
          <span className="text-xs font-semibold text-zinc-200 truncate">{title}</span>
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-2 animate-pulse">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              {showAvatar && <div className="h-7 w-7 rounded-full bg-zinc-300/40 dark:bg-zinc-700/40" />}
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-3/5 rounded bg-zinc-300/50 dark:bg-zinc-700/50" />
                <div className="h-2 w-2/5 rounded bg-zinc-300/30 dark:bg-zinc-700/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
        <span className="text-lg">👥</span>
        <span className="text-xs text-red-400/70">Teachers unavailable</span>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.05] shrink-0">
        <span className="text-sm">👥</span>
        <span className="text-xs font-semibold text-zinc-200 truncate">{title}</span>
        <span className="ml-auto text-[10px] text-zinc-500 tabular-nums">{filtered.length}</span>
      </div>

      <ScrollColumn scrollSpeed={scrollSpeed}>
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 py-8">
            <p className="text-xs text-zinc-500 text-center">
              {filter === "available"
                ? "Every teacher is in class right now."
                : filter === "in_class"
                ? "No teachers currently teaching."
                : "No teachers to show."}
            </p>
          </div>
        ) : (
          filtered.map((t) => (
            <TeacherRow key={t.teacher_id} teacher={t} display={display} showAvatar={showAvatar} />
          ))
        )}
      </ScrollColumn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function TeacherRow({
  teacher, display, showAvatar,
}: {
  teacher: TeacherNow
  display: TeacherDisplaySettings
  showAvatar: boolean
}) {
  const inClass = !!teacher.current_entry
  const info = statusInfo(teacher.status)
  const e = teacher.current_entry
  const next = teacher.next_entry

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    blue: "bg-blue-400",
    violet: "bg-violet-400",
    red: "bg-red-400",
  }
  const dot = colorMap[info.color] ?? "bg-zinc-500"

  return (
    <div className="flex items-start gap-2.5 px-3 py-2 border-b border-white/[0.04] last:border-b-0">
      {showAvatar && (
        <div className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400 relative">
          {teacher.teacher_name.slice(0, 1).toUpperCase()}
          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-zinc-900 ${dot}`} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <p className="text-xs font-semibold text-zinc-100 truncate">{teacher.teacher_name}</p>
          {!showAvatar && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        </div>

        {display.cardStyle === "compact" ? (
          <p className="text-[10px] text-zinc-500 truncate">
            {inClass
              ? `Teaching${display.showSubject && e?.subject ? ` ${e.subject}` : ""}${display.showRoom && e?.room ? ` · ${e.room}` : ""}`
              : `Available${display.showRoom && teacher.cabin ? ` · ${teacher.cabin}` : ""}`}
          </p>
        ) : inClass ? (
          <>
            <p className="text-[10px] uppercase tracking-widest text-blue-400/70 mt-0.5">In class</p>
            <p className="text-[11px] text-blue-100 leading-tight truncate">
              {display.showSubject && e?.subject ? e.subject : "—"}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0 text-[9px] text-zinc-500">
              {display.showRoom && e?.room && <span>📍 {e.room}</span>}
              <span className="tabular-nums">
                {formatTime(e!.start_time, display.timeFormat)}–{formatTime(e!.end_time, display.timeFormat)}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 mt-0.5">
              Available{teacher.cabin && display.showRoom ? " · cabin" : ""}
            </p>
            <p className="text-[11px] text-zinc-200 leading-tight truncate">
              {display.showRoom && teacher.cabin ? teacher.cabin : "Free"}
            </p>
            {display.showNextClass && next && (
              <p className="text-[9px] text-zinc-500 truncate">
                Next: {next.subject || "class"} at {formatTime(next.start_time, display.timeFormat)}
                {display.showRoom && next.room ? ` · ${next.room}` : ""}
              </p>
            )}
            {display.showStatusNote && teacher.status_note && (
              <p className="text-[9px] text-zinc-600 italic truncate">{teacher.status_note}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-scroll wrapper
//
// If content is taller than the viewport, we duplicate it once and animate
// translateY from 0 → -50% so the seam where the second copy starts hits
// the top exactly when the first copy has scrolled out — the loop is
// visually seamless.
// ---------------------------------------------------------------------------

function ScrollColumn({
  children, scrollSpeed,
}: { children: React.ReactNode; scrollSpeed: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [duration, setDuration] = useState(0)

  const measure = useCallback(() => {
    const c = containerRef.current
    const inner = innerRef.current
    if (!c || !inner) return
    // First child holds one full copy of the rendered content.
    const copy = inner.firstElementChild as HTMLElement | null
    if (!copy) return
    const contentH = copy.offsetHeight
    const viewportH = c.clientHeight
    const isOver = contentH > viewportH + 1 && scrollSpeed > 0
    setOverflow(isOver)
    if (isOver) setDuration(contentH / Math.max(1, scrollSpeed))
  }, [scrollSpeed])

  useLayoutEffect(() => { measure() }, [measure, children])

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => measure())
    if (containerRef.current) ro.observe(containerRef.current)
    if (innerRef.current?.firstElementChild) ro.observe(innerRef.current.firstElementChild as Element)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden relative">
      <div
        ref={innerRef}
        className={overflow ? "teachers-scroll-loop" : ""}
        style={overflow ? { animationDuration: `${duration}s` } : undefined}
      >
        <div>{children}</div>
        {overflow && <div aria-hidden>{children}</div>}
      </div>

      <style jsx>{`
        .teachers-scroll-loop {
          animation-name: teachers-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes teachers-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  )
}
