"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { TileConfig } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StackChild {
  /** Tile-type string used by WidgetContent (e.g. "clock", "banner", "weather"). */
  type: string
  /** Child's TileConfig (same shape as a normal tile's parsed config_json). */
  config: TileConfig
  /** Optional media reference, mirrors TileRead.media_id. */
  media_id?: number | null
  /** Optional inline notice payload — stacks don't link DB notices. */
  inline_notice?: { title?: string; body?: string; category?: string } | null
  /** Human label for the inspector list. Falls back to type. */
  label?: string
}

export function parseStackChildren(raw?: string | null): StackChild[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).type === "string")
      .map((c) => ({
        type: c.type as string,
        config: (c.config && typeof c.config === "object" ? (c.config as TileConfig) : {}),
        media_id: typeof c.media_id === "number" ? (c.media_id as number) : null,
        inline_notice: (c.inline_notice && typeof c.inline_notice === "object")
          ? (c.inline_notice as StackChild["inline_notice"])
          : null,
        label: typeof c.label === "string" ? (c.label as string) : undefined,
      }))
  } catch {
    return []
  }
}

export function stringifyStackChildren(children: StackChild[]): string {
  return JSON.stringify(children)
}

// ---------------------------------------------------------------------------
// Display — full rotating stack for display-canvas
// ---------------------------------------------------------------------------

interface DisplayProps {
  items: StackChild[]
  interval: number
  transition: "fade" | "slide" | "none"
  showDots: boolean
  paused: boolean
  renderChild: (child: StackChild) => ReactNode
}

export function StackDisplay({
  items, interval, transition, showDots, paused, renderChild,
}: DisplayProps) {
  const [current, setCurrent] = useState(0)
  const count = items.length

  useEffect(() => {
    if (paused || count <= 1) return
    const ms = Math.max(1, interval) * 1000
    const t = setInterval(() => setCurrent((i) => (i + 1) % count), ms)
    return () => clearInterval(t)
  }, [paused, count, interval])

  // Reset to a valid index if items shrink while we were displaying a later one.
  useEffect(() => {
    if (current >= count && count > 0) setCurrent(0)
  }, [count, current])

  if (count === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-500">
        <span className="text-xl opacity-40">🗂️</span>
        <p className="text-xs">Empty stack</p>
      </div>
    )
  }

  const idx = current % count
  const child = items[idx]

  // Each child mounts as its own keyed div so transitions actually trigger and
  // heavy widgets (video) reinitialise cleanly when their slot becomes active.
  const animCls =
    transition === "fade" ? "animate-stack-fade" :
    transition === "slide" ? "animate-stack-slide-up" : ""

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div key={idx} className={`absolute inset-0 ${animCls}`}>
        {renderChild(child)}
      </div>

      {showDots && count > 1 && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 flex gap-1 rounded-full bg-black/35 px-1.5 py-1 backdrop-blur-sm">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx ? "w-4 bg-white/85" : "w-1.5 bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Builder preview — compact, shows current child + dots, also rotates
// ---------------------------------------------------------------------------

interface PreviewProps {
  items: StackChild[]
  interval: number
}

export function StackPreview({ items, interval }: PreviewProps) {
  const [idx, setIdx] = useState(0)
  const count = items.length

  useEffect(() => {
    if (count <= 1) return
    const ms = Math.max(1, interval) * 1000
    const t = setInterval(() => setIdx((i) => (i + 1) % count), ms)
    return () => clearInterval(t)
  }, [count, interval])

  if (count === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md bg-fuchsia-950/15">
        <span className="text-lg opacity-60">🗂️</span>
        <span className="text-[9px] text-fuchsia-300/70">Stack</span>
        <span className="text-[8px] text-zinc-600">No widgets</span>
      </div>
    )
  }

  const child = items[idx % count]
  const label = child.label || child.type

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-fuchsia-950/15">
      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-2">
        <span className="text-base">{TYPE_ICONS[child.type] ?? "⬛"}</span>
        <span className="text-[10px] font-medium text-fuchsia-200/80 truncate max-w-full">
          {label}
        </span>
        <span className="text-[8px] text-fuchsia-400/50 tabular-nums">
          {(idx % count) + 1} / {count}
        </span>
      </div>

      <div className="absolute top-1 left-1.5 right-1.5 flex justify-between items-center pointer-events-none">
        <span className="text-[8px] font-bold uppercase tracking-wider text-fuchsia-400/70 bg-black/30 px-1 rounded">
          stack
        </span>
        <span className="text-[8px] text-fuchsia-400/50 tabular-nums bg-black/30 px-1 rounded">
          {interval}s
        </span>
      </div>

      {count > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === idx % count ? "w-2.5 bg-fuchsia-300/80" : "w-1 bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const TYPE_ICONS: Record<string, string> = {
  notice: "📋",
  banner: "📢",
  ticker: "📜",
  clock: "🕐",
  weather: "🌤️",
  image: "🖼️",
  video: "🎬",
  carousel: "🎠",
  pdf: "📄",
  emergency: "🚨",
  sensor: "📡",
  timetable: "📅",
  teacher_status: "👤",
  teachers_list: "👥",
  stack: "🗂️",
}
