"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  url: string
  poster?: string
  loop?: boolean
  /** "cover" crops to fill, "contain" letterboxes (no cropping), "fill" stretches to exact tile size. */
  fit?: "cover" | "contain" | "fill"
  /** When true, overlays a small debug HUD with playback state. Toggle by appending ?vdebug to the URL. */
  debugHud?: boolean
}

const YOUTUBE_RE =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/

export function extractYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_RE)
  return m?.[1] ?? null
}

/**
 * Display-only video player. Always autoplay, always loop, always muted, no
 * controls, no overlay. Aggressively retries play() on a 2s tick because
 * WebKit2GTK (used by pywebview on Pi/Linux) silently rejects autoplay on
 * a freshly-mounted element under some media policies — the retry self-heals
 * without any user gesture.
 */
export function VideoPlayer({ url, poster, loop = true, fit = "cover", debugHud = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [errored, setErrored] = useState(false)
  const [hud, setHud] = useState<string>("init")

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true

    // WebKit2GTK (pywebview's renderer) is unreliable about looping
    // Range-served video. Both <video loop> and currentTime=0 after
    // `ended` can leave the element stuck at the last frame. The robust
    // recovery is to call load(), which re-issues the request from byte
    // 0 and gets us a fresh, playable buffer.
    let replays = 0
    let lastErr = ""
    const replay = (reason: string) => {
      replays += 1
      v.muted = true
      try { v.currentTime = 0 } catch { /* not seekable yet */ }
      const p = v.play()
      if (p && typeof p.catch === "function") {
        p.catch((e: Error) => {
          lastErr = `play:${e.name}`
          try { v.load() } catch { /* ignore */ }
          v.play().catch((e2: Error) => { lastErr = `reload:${e2.name}` })
        })
      }
      if (debugHud) setHud(`replay#${replays} (${reason}) err=${lastErr || "-"}`)
    }

    const tick = () => {
      if (debugHud) {
        setHud(
          `t=${v.currentTime.toFixed(2)}/${Number.isFinite(v.duration) ? v.duration.toFixed(2) : "?"} ` +
          `p=${v.paused} e=${v.ended} rs=${v.readyState} ns=${v.networkState} ` +
          `replays=${replays} err=${lastErr || "-"}`,
        )
      }
      if (v.ended) replay("ended")
      else if (v.paused) replay("paused")
      // Pre-empt buggy `ended`: if we're at the tail, force loop ourselves.
      else if (v.duration && Number.isFinite(v.duration) && v.currentTime >= v.duration - 0.15) replay("tail")
    }

    v.addEventListener("ended", () => replay("ended-evt"))
    tick()
    const interval = setInterval(tick, 500)
    return () => {
      clearInterval(interval)
    }
  }, [url, debugHud])

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900/80">
        <p className="text-sm text-zinc-500">No video configured</p>
      </div>
    )
  }

  const ytId = extractYouTubeId(url)
  if (ytId) {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: loop ? "1" : "0",
      playlist: ytId,
      controls: "0",
      modestbranding: "1",
      rel: "0",
      playsinline: "1",
    })
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${ytId}?${params.toString()}`}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        frameBorder="0"
      />
    )
  }

  if (errored) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-900/80 p-3 text-center">
        <span className="text-2xl">⚠️</span>
        <p className="text-xs text-zinc-400">Video failed to load</p>
        <p className="text-[10px] text-zinc-600 break-all line-clamp-2">{url}</p>
      </div>
    )
  }

  return (
    <>
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        autoPlay
        loop={loop}
        muted
        playsInline
        preload="auto"
        onError={() => setErrored(true)}
        className={`absolute inset-0 h-full w-full bg-black ${fit === "fill" ? "object-fill" : fit === "contain" ? "object-contain" : "object-cover"}`}
      />
      {debugHud && (
        <div className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
          {hud}
        </div>
      )}
    </>
  )
}
