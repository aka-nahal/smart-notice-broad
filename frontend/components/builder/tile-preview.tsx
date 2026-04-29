"use client"

import { useEffect, useState } from "react"
import type { TileRead, NoticeRead } from "@/lib/types"
import { WeatherWidget } from "@/components/weather-widget"
import { CarouselPreview, parseSlides } from "@/components/carousel-widget"
import { StackPreview, parseStackChildren } from "@/components/stack-widget"

interface Props {
  tile: TileRead
  notice: NoticeRead | null
  isSelected: boolean
  isLocked: boolean
  singleSelect: boolean
  idleMode: boolean
}

export function TilePreview({ tile, notice, isSelected, isLocked, singleSelect, idleMode }: Props) {
  const cfg = (() => { try { return JSON.parse(tile.config_json ?? "{}") } catch { return {} } })()
  const type = tile.tile_type
  const hasImage = tile.media_id || cfg.imageUrl
  const customBg = cfg.bgColor ? { backgroundColor: cfg.bgColor } : undefined
  const customText = cfg.textColor ? { color: cfg.textColor } : undefined

  // Live clock for clock tiles
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    if (type !== "clock") return
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [type])

  if (type === "image" && hasImage) {
    const src = tile.media_id ? `/api/media/${tile.media_id}` : cfg.imageUrl
    return (
      <div className="relative h-full w-full" style={customBg}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={cfg.imageAlt ?? ""} className="h-full w-full object-cover rounded-md" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-md" />
        <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between">
          <span className="text-[8px] font-bold uppercase text-white/60 tracking-wider bg-black/30 px-1 rounded">image</span>
          {cfg.imageAlt && <span className="text-[8px] text-white/40 truncate ml-1">{cfg.imageAlt}</span>}
        </div>
      </div>
    )
  }

  if (type === "video") {
    const videoUrl = cfg.videoUrl as string | undefined
    const mediaSrc = tile.media_id ? `/api/media/${tile.media_id}` : null
    // Check for YouTube
    const ytMatch = videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    const ytId = ytMatch?.[1] ?? null

    return (
      <div className="relative h-full w-full bg-pink-950/20 rounded-md" style={customBg}>
        {ytId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover rounded-md" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
              <div className="rounded-lg bg-red-600 px-2 py-1 flex items-center gap-1 shadow-lg">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                <span className="text-[9px] font-bold text-white">YouTube</span>
              </div>
            </div>
          </>
        ) : mediaSrc || videoUrl ? (
          <>
            <video
              src={mediaSrc || videoUrl}
              className="h-full w-full object-cover rounded-md"
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-md pointer-events-none" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <span className="text-lg">🎬</span>
            <span className="text-[9px] text-zinc-600">No video set</span>
          </div>
        )}
        <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between pointer-events-none">
          <span className={`text-[8px] font-bold uppercase tracking-wider bg-black/40 px-1 rounded ${ytId ? "text-red-400" : "text-pink-400/70"}`}>
            {ytId ? "youtube" : "video"}
          </span>
          {cfg.videoLoop === "false" && <span className="text-[8px] text-white/40 bg-black/30 px-1 rounded">no loop</span>}
        </div>
      </div>
    )
  }

  if (type === "banner") {
    const title = cfg.bannerTitle || "Banner Title"
    const subtitle = cfg.bannerSubtitle || ""
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-r from-sky-600/15 to-indigo-600/15 px-3 rounded-md" style={customBg}>
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-sky-400/50 mb-1">banner</span>
        <span className="max-w-full truncate text-sm font-semibold tracking-tight" style={customText ?? { color: "rgb(212 212 216)" }}>{title}</span>
        {subtitle && <span className="max-w-full truncate text-[10px] mt-0.5" style={customText ? { color: cfg.textColor, opacity: 0.7 } : { color: "rgb(113 113 122)" }}>{subtitle}</span>}
      </div>
    )
  }

  if (type === "ticker") {
    const text = cfg.tickerText || "Scrolling ticker text..."
    return (
      <div className="flex h-full items-center px-3 overflow-hidden rounded-md" style={customBg}>
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-amber-400/60 shrink-0 mr-2">ticker</span>
        <div className="flex-1 overflow-hidden relative">
          <span className="text-[11px] whitespace-nowrap animate-marquee inline-block" style={customText ?? { color: "rgb(217 119 6 / 0.5)" }}>{text}</span>
        </div>
        <span className="text-[8px] text-amber-500/30 shrink-0 ml-1">▶</span>
      </div>
    )
  }

  if (type === "clock") {
    const fmt = cfg.clockFormat === "12h"
      ? time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      : time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    const dateStr = time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 rounded-md" style={customBg}>
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-violet-400/50">clock</span>
        <span className="text-lg font-bold tabular-nums tracking-tight" style={customText ?? { color: "rgb(167 139 250 / 0.8)" }}>{fmt}</span>
        <span className="text-[9px]" style={customText ? { color: cfg.textColor, opacity: 0.5 } : { color: "rgb(139 92 246 / 0.4)" }}>{dateStr}</span>
      </div>
    )
  }

  if (type === "weather") {
    return (
      <div className="h-full rounded-md" style={customBg}>
        <WeatherWidget
          city={(cfg.weatherCity as string) || "London"}
          units={(cfg.weatherUnits as "metric" | "imperial") || "metric"}
          compact
        />
      </div>
    )
  }

  if (type === "carousel") {
    const slides = parseSlides(cfg.carouselSlides as string)
    return (
      <div className="h-full rounded-md" style={customBg}>
        <CarouselPreview slides={slides} interval={(cfg.carouselInterval as number) || 5} />
      </div>
    )
  }

  if (type === "stack") {
    const items = parseStackChildren(cfg.stackChildren as string)
    return (
      <div className="h-full rounded-md" style={customBg}>
        <StackPreview items={items} interval={(cfg.stackInterval as number) || 8} />
      </div>
    )
  }

  if (type === "teachers_list") {
    const filter = (cfg.teachersFilter as string) || "all"
    const title  = (cfg.teachersTitle as string) || "Teachers"
    const filterLabel: Record<string, string> = {
      all: "All",
      available: "Available now",
      in_class: "In class",
      busy: "Busy",
    }
    return (
      <div className="flex h-full flex-col rounded-md bg-indigo-950/30" style={customBg}>
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-indigo-500/20">
          <span className="text-xs">👥</span>
          <span className="text-[10px] font-semibold text-indigo-200 truncate">{title}</span>
          <span className="ml-auto text-[8px] text-indigo-400/70">{filterLabel[filter] ?? filter}</span>
        </div>
        <div className="flex-1 px-2 py-1 space-y-1 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-1.5 opacity-60">
              <span className="h-3.5 w-3.5 rounded-full bg-indigo-500/20" />
              <div className="flex-1 min-w-0">
                <div className="h-1 w-3/4 rounded bg-indigo-500/30" />
                <div className="h-0.5 w-1/2 mt-0.5 rounded bg-indigo-500/15" />
              </div>
            </div>
          ))}
        </div>
        <div className="px-2 pb-1 text-[8px] text-indigo-400/60 italic">↻ scrolls if overflows</div>
      </div>
    )
  }

  if (type === "emergency") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md bg-red-500/5 relative overflow-hidden" style={customBg}>
        {/* Animated pulse border */}
        <div className="absolute inset-0 rounded-md border border-red-500/20 animate-pulse" />
        <div className="flex items-center gap-1">
          <span className="text-xs">🚨</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-red-400/70">emergency</span>
        </div>
        {notice ? (
          <span className="max-w-full truncate text-xs font-medium px-2" style={customText ?? { color: "rgb(212 212 216)" }}>{notice.title}</span>
        ) : (
          <span className="text-[10px] text-zinc-600 italic">No notice assigned</span>
        )}
        {notice && (
          <span className="max-w-full truncate text-[9px] px-2" style={customText ? { color: cfg.textColor, opacity: 0.5 } : { color: "rgb(161 161 170)" }}>{notice.summary || notice.body}</span>
        )}
      </div>
    )
  }

  // Default: notice / event tile
  return (
    <div className="flex h-full flex-col p-2 rounded-md" style={customBg}>
      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-zinc-500/70 mb-1">{type}</span>
      {notice ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <p className="text-xs font-medium leading-tight truncate" style={customText ?? { color: "rgb(228 228 231)" }}>{notice.title}</p>
          {tile.grid_h >= 2 && (
            <p className="mt-0.5 text-[10px] leading-snug line-clamp-3" style={customText ? { color: cfg.textColor, opacity: 0.6 } : { color: "rgb(161 161 170)" }}>
              {notice.summary || notice.body}
            </p>
          )}
          {notice.category && (
            <span className="inline-block mt-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-medium text-blue-400/70 border border-blue-500/20">
              {notice.category}
            </span>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] text-zinc-600 italic">No notice assigned</span>
          <span className="text-[8px] text-zinc-700">{tile.grid_w}&times;{tile.grid_h}</span>
        </div>
      )}

      {/* Drag hint */}
      {isSelected && idleMode && !isLocked && singleSelect && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <span className="text-[7px] text-blue-400/50 bg-zinc-900/60 rounded px-1.5 py-0.5">drag to move</span>
        </div>
      )}
    </div>
  )
}
