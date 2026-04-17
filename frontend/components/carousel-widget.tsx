"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CarouselSlide {
  type: "image" | "pdf" | "youtube" | "video"
  url: string
  caption?: string
}

export function parseSlides(raw?: string | null): CarouselSlide[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((s: unknown) => {
      if (typeof s !== "object" || s === null) return false
      const o = s as Record<string, unknown>
      return typeof o.url === "string" && typeof o.type === "string"
    })
  } catch {
    return []
  }
}

export function stringifySlides(slides: CarouselSlide[]): string {
  return JSON.stringify(slides)
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

// ---------------------------------------------------------------------------
// Compact preview for builder
// ---------------------------------------------------------------------------

export function CarouselPreview({ slides, interval = 5 }: { slides: CarouselSlide[]; interval?: number }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), interval * 1000)
    return () => clearInterval(t)
  }, [slides.length, interval])

  if (slides.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1">
        <span className="text-lg">🎠</span>
        <span className="text-[9px] text-zinc-600">No slides</span>
        <span className="text-[8px] text-zinc-700">Add images or PDFs</span>
      </div>
    )
  }

  const slide = slides[idx % slides.length]

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md">
      {/* Current slide */}
      {slide.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.url} alt={slide.caption ?? ""} className="h-full w-full object-cover" />
      ) : slide.type === "youtube" ? (
        <div className="flex h-full items-center justify-center bg-red-950/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://img.youtube.com/vi/${extractYouTubeId(slide.url) ?? ""}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="rounded-lg bg-red-600 px-1.5 py-0.5 flex items-center gap-0.5">
              <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              <span className="text-[8px] font-bold text-white">YT</span>
            </div>
          </div>
        </div>
      ) : slide.type === "pdf" ? (
        <div className="flex h-full flex-col items-center justify-center bg-rose-950/10 gap-1">
          <span className="text-base">📄</span>
          <span className="text-[8px] text-zinc-500 truncate max-w-full px-2">{slide.url.split("/").pop()}</span>
        </div>
      ) : slide.type === "video" ? (
        <div className="flex h-full items-center justify-center bg-pink-950/10">
          <span className="text-base">🎬</span>
        </div>
      ) : null}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Slide counter + caption */}
      <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between pointer-events-none">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold uppercase tracking-wider text-orange-400/70 bg-black/40 px-1 rounded">carousel</span>
          {slide.caption && <span className="text-[8px] text-white/50 truncate">{slide.caption}</span>}
        </div>
        <span className="text-[8px] tabular-nums text-white/40 bg-black/40 px-1 rounded">{idx + 1}/{slides.length}</span>
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {slides.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === idx % slides.length ? "w-2.5 bg-orange-400/80" : "w-1 bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full carousel for display
// ---------------------------------------------------------------------------

interface DisplayProps {
  slides: CarouselSlide[]
  interval?: number
  transition?: "fade" | "slide" | "none"
  showDots?: boolean
  showArrows?: boolean
  autoplay?: boolean
  /** Show a thin animated progress bar under the slide (timer indicator). */
  showProgress?: boolean
  /** Apply a slow zoom/pan ("Ken Burns") to image slides. */
  kenBurns?: boolean
  /** Image / video fit: "cover" crops, "contain" letterboxes, "fill" stretches to exact size. */
  fit?: "cover" | "contain" | "fill"
}

export function CarouselDisplay({
  slides,
  interval = 5,
  transition = "fade",
  showDots = true,
  showArrows = false,
  autoplay = true,
  showProgress = true,
  kenBurns = false,
  fit = "cover",
}: DisplayProps) {
  const [current, setCurrent] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [direction, setDirection] = useState<"next" | "prev">("next")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const count = slides.length

  const goTo = useCallback((i: number, dir: "next" | "prev" = "next") => {
    setDirection(dir)
    setCurrent(((i % count) + count) % count)
  }, [count])

  const next = useCallback(() => goTo(current + 1, "next"), [current, goTo])
  const prev = useCallback(() => goTo(current - 1, "prev"), [current, goTo])

  // Autoplay timer
  useEffect(() => {
    if (!autoplay || count <= 1) return
    timerRef.current = setInterval(next, interval * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoplay, count, interval, next])

  if (count === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        <p className="text-sm">No slides configured</p>
      </div>
    )
  }

  const slide = slides[current]
  const ytId = slide.type === "youtube" ? extractYouTubeId(slide.url) : null

  // Transition classes
  const transitionCls = transition === "fade"
    ? "transition-opacity duration-700"
    : transition === "slide"
    ? "transition-transform duration-500"
    : ""

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Slide content */}
      <div key={current} className={`absolute inset-0 ${transitionCls}`}>
        {slide.type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.url} alt={slide.caption ?? ""}
            className={`h-full w-full ${fit === "fill" ? "object-fill" : fit === "contain" ? "object-contain" : "object-cover"} ${kenBurns && fit !== "fill" ? "animate-ken-burns" : ""}`}
            loading="lazy" />
        )}
        {slide.type === "youtube" && ytId && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&modestbranding=1&rel=0`}
            className="h-full w-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            frameBorder="0"
          />
        )}
        {slide.type === "pdf" && (
          <iframe
            src={`${slide.url}#toolbar=0&navpanes=0&statusbar=0&view=Fit`}
            className="h-full w-full bg-white" title={slide.caption ?? "PDF"} />
        )}
        {slide.type === "video" && (
          <video src={slide.url} autoPlay muted loop playsInline
            className={`h-full w-full ${fit === "fill" ? "object-fill" : fit === "contain" ? "object-contain" : "object-cover"}`} />
        )}
      </div>

      {/* Progress bar */}
      {showProgress && autoplay && count > 1 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
          <div
            key={`${current}-${interval}`}
            className="h-full bg-white/70"
            style={{ animation: `carousel-progress ${interval}s linear forwards` }}
          />
        </div>
      )}

      {/* Caption */}
      {slide.caption && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 pointer-events-none">
          <p className="text-sm font-medium text-white/90">{slide.caption}</p>
        </div>
      )}

      {/* Navigation arrows */}
      {showArrows && count > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {showDots && count > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i, i > current ? "next" : "prev")}
              className={`h-2 rounded-full transition-all ${
                i === current ? "w-5 bg-white/80" : "w-2 bg-white/30 hover:bg-white/50"
              }`} />
          ))}
        </div>
      )}

      {/* Slide counter */}
      <div className="absolute top-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] tabular-nums text-white/60 backdrop-blur-sm">
        {current + 1} / {count}
      </div>
    </div>
  )
}
