"use client"

import { useEffect, useState } from "react"

export type ClockStyle = "digital" | "analog" | "minimal" | "flip" | "word"
export type ClockDateFormat = "short" | "long" | "iso"

export interface ClockProps {
  style?: ClockStyle
  format?: "12h" | "24h"
  showSeconds?: boolean
  showDate?: boolean
  timezone?: string
  dateFormat?: ClockDateFormat
}

function partsInZone(d: Date, timezone?: string) {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }
  if (timezone) opts.timeZone = timezone
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(d)
  } catch {
    parts = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d)
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0")
  return { h: get("hour"), m: get("minute"), s: get("second") }
}

function formatTime(d: Date, format: "12h" | "24h", showSeconds: boolean, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: format === "12h" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: format === "12h",
  }
  if (showSeconds) opts.second = "2-digit"
  if (timezone) opts.timeZone = timezone
  try { return new Intl.DateTimeFormat("en-US", opts).format(d) }
  catch { return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: undefined }).format(d) }
}

function formatDate(d: Date, fmt: ClockDateFormat, timezone?: string): string {
  const tz = timezone ? { timeZone: timezone } : {}
  try {
    if (fmt === "iso") {
      const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", ...tz }
      const parts = new Intl.DateTimeFormat("en-CA", opts).formatToParts(d)
      const y = parts.find((p) => p.type === "year")?.value
      const m = parts.find((p) => p.type === "month")?.value
      const day = parts.find((p) => p.type === "day")?.value
      return `${y}-${m}-${day}`
    }
    if (fmt === "long") {
      return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", ...tz }).format(d)
    }
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", ...tz }).format(d)
  } catch {
    return d.toDateString()
  }
}

function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const fg: React.CSSProperties = { color: "var(--tile-fg, #ffffff)" }
const fgMuted: React.CSSProperties = { color: "var(--tile-fg-muted, #a1a1aa)" }
const fgSubtle: React.CSSProperties = { color: "var(--tile-fg-subtle, #71717a)" }

// ---------------------------------------------------------------------------

export function ClockWidget({
  style = "digital",
  format = "24h",
  showSeconds = true,
  showDate = true,
  timezone,
  dateFormat = "long",
}: ClockProps) {
  const now = useNow(1000)
  if (!now) return null

  const time = formatTime(now, format, showSeconds, timezone)
  const date = showDate ? formatDate(now, dateFormat, timezone) : ""

  if (style === "analog") return <AnalogClock now={now} timezone={timezone} date={date} />
  if (style === "minimal") return <MinimalClock time={time} />
  if (style === "flip") return <FlipClock time={time} date={date} />
  if (style === "word") return <WordClock now={now} timezone={timezone} date={date} />
  return <DigitalClock time={time} date={date} />
}

function DigitalClock({ time, date }: { time: string; date: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center" style={{ containerType: "size" }}>
      <p className="font-bold tabular-nums tracking-tight" style={{ ...fg, fontSize: "clamp(2rem, 18cqi, 8rem)", lineHeight: 1 }}>
        {time}
      </p>
      {date && (
        <p className="mt-2" style={{ ...fgMuted, fontSize: "clamp(0.75rem, 4.5cqi, 1.75rem)" }}>
          {date}
        </p>
      )}
    </div>
  )
}

function MinimalClock({ time }: { time: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ containerType: "size" }}>
      <p className="font-extralight tabular-nums tracking-tighter" style={{ ...fg, fontSize: "clamp(2.5rem, 26cqi, 12rem)", lineHeight: 0.9 }}>
        {time}
      </p>
    </div>
  )
}

function AnalogClock({ now, timezone, date }: { now: Date; timezone?: string; date: string }) {
  const { h, m, s } = partsInZone(now, timezone)
  const secAngle = s * 6
  const minAngle = m * 6 + s * 0.1
  const hourAngle = (h % 12) * 30 + m * 0.5

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2" style={{ containerType: "size" }}>
      <div className="relative aspect-square h-full max-h-full" style={{ width: "min(100%, 90cqh)" }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="48" fill="var(--tile-card, rgb(24 24 27 / 0.6))" stroke="var(--tile-border, #3f3f46)" strokeWidth="1" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 - 90) * (Math.PI / 180)
            const x1 = 50 + Math.cos(a) * 42
            const y1 = 50 + Math.sin(a) * 42
            const x2 = 50 + Math.cos(a) * 46
            const y2 = 50 + Math.sin(a) * 46
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--tile-fg-muted, #a1a1aa)" strokeWidth="1.5" strokeLinecap="round" />
          })}
          <line x1="50" y1="50" x2="50" y2="26" stroke="var(--tile-fg, #ffffff)" strokeWidth="3" strokeLinecap="round"
            style={{ transform: `rotate(${hourAngle}deg)`, transformOrigin: "50px 50px" }} />
          <line x1="50" y1="50" x2="50" y2="14" stroke="var(--tile-fg, #ffffff)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: `rotate(${minAngle}deg)`, transformOrigin: "50px 50px" }} />
          <line x1="50" y1="56" x2="50" y2="10" stroke="#ef4444" strokeWidth="1" strokeLinecap="round"
            style={{ transform: `rotate(${secAngle}deg)`, transformOrigin: "50px 50px" }} />
          <circle cx="50" cy="50" r="2.5" fill="#ef4444" />
        </svg>
      </div>
      {date && <p style={{ ...fgMuted, fontSize: "clamp(0.625rem, 3.5cqi, 1rem)" }}>{date}</p>}
    </div>
  )
}

function FlipClock({ time, date }: { time: string; date: string }) {
  const chars = time.split("")
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ containerType: "size" }}>
      <div className="flex items-center gap-1">
        {chars.map((c, i) => {
          if (/\d/.test(c)) {
            return (
              <span key={i} className="inline-flex items-center justify-center rounded-md font-bold tabular-nums shadow-inner"
                style={{
                  ...fg,
                  background: "var(--tile-card, #18181b)",
                  border: "1px solid var(--tile-border, #3f3f46)",
                  fontSize: "clamp(1.5rem, 14cqi, 6rem)",
                  padding: "0.1em 0.25em",
                  lineHeight: 1,
                }}>
                {c}
              </span>
            )
          }
          return (
            <span key={i} className="font-bold" style={{ ...fgMuted, fontSize: "clamp(1.25rem, 12cqi, 5rem)", lineHeight: 1 }}>
              {c}
            </span>
          )
        })}
      </div>
      {date && <p style={{ ...fgMuted, fontSize: "clamp(0.7rem, 3.5cqi, 1.25rem)" }}>{date}</p>}
    </div>
  )
}

const NUMBER_WORDS = [
  "twelve", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten", "eleven",
]

function timeAsWords(h: number, m: number): string {
  const hourWord = (n: number) => NUMBER_WORDS[((n % 12) + 12) % 12]
  if (m === 0) {
    if (h === 0) return "midnight"
    if (h === 12) return "noon"
    return `${hourWord(h)} o'clock`
  }
  if (m === 15) return `quarter past ${hourWord(h)}`
  if (m === 30) return `half past ${hourWord(h)}`
  if (m === 45) return `quarter to ${hourWord(h + 1)}`
  if (m < 30) {
    const phrase = m === 1 ? "one minute" : `${m} minutes`
    return `${phrase} past ${hourWord(h)}`
  }
  const left = 60 - m
  const phrase = left === 1 ? "one minute" : `${left} minutes`
  return `${phrase} to ${hourWord(h + 1)}`
}

function WordClock({ now, timezone, date }: { now: Date; timezone?: string; date: string }) {
  const { h, m } = partsInZone(now, timezone)
  const phrase = timeAsWords(h, m)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center" style={{ containerType: "size" }}>
      <p className="font-semibold uppercase tracking-[0.25em]" style={{ ...fgSubtle, fontSize: "clamp(0.55rem, 2.5cqi, 0.75rem)" }}>it&rsquo;s</p>
      <p className="font-semibold leading-tight" style={{ ...fg, fontSize: "clamp(1.25rem, 8cqi, 3.5rem)" }}>
        {phrase}
      </p>
      {date && <p style={{ ...fgMuted, fontSize: "clamp(0.7rem, 3.5cqi, 1.25rem)" }}>{date}</p>}
    </div>
  )
}
