"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  url: string
  poster?: string
  autoplay?: boolean
  loop?: boolean
  controls?: boolean
  muted?: boolean
  /** "cover" crops to fill, "contain" letterboxes (no cropping), "fill" stretches to exact tile size. */
  fit?: "cover" | "contain" | "fill"
  /** Show a small play indicator when paused. */
  showOverlay?: boolean
}

const YOUTUBE_RE =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/

export function extractYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_RE)
  return m?.[1] ?? null
}

/**
 * Unified video player for the display canvas. Handles:
 *  - YouTube embeds (autoplay, mute, loop, no chrome by default)
 *  - Direct video files (HTML5 <video>) with proper fit, poster, error fallback
 *  - Failed/missing source: friendly placeholder instead of a broken element
 */
export function VideoPlayer({
  url,
  poster,
  autoplay = true,
  loop = true,
  controls = false,
  muted = true,
  fit = "cover",
  showOverlay = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [errored, setErrored] = useState(false)
  const [paused, setPaused] = useState(!autoplay)

  // Autoplay rules require muted; reflect changes if user toggles mute.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  // Kick off playback explicitly. Handles browsers that ignore the autoplay
  // attribute on a freshly-mounted video and the case where the play() promise
  // is silently rejected (returns a Promise<void> that we must catch).
  useEffect(() => {
    if (!autoplay || !videoRef.current) return
    const v = videoRef.current
    v.muted = true  // browsers require muted for unattended autoplay
    const p = v.play()
    if (p && typeof p.catch === "function") {
      p.catch(() => setPaused(true))
    }
  }, [autoplay, url])

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
      autoplay: autoplay ? "1" : "0",
      mute: "1",
      loop: loop ? "1" : "0",
      playlist: ytId,
      controls: controls ? "1" : "0",
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
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        controls={controls}
        preload="auto"
        onError={() => setErrored(true)}
        onPause={() => setPaused(true)}
        onPlay={() => setPaused(false)}
        className={`absolute inset-0 h-full w-full ${fit === "fill" ? "object-fill" : fit === "contain" ? "object-contain" : "object-cover"}`}
      />
      {showOverlay && paused && !controls && (
        <button
          onClick={() => videoRef.current?.play()}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white transition-opacity hover:bg-black/30"
          aria-label="Play video"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
      )}
    </div>
  )
}
