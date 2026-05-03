"use client"

/**
 * Screen Saver overlay for the live display.
 *
 * Activates when:
 *   - the browser sees no mouse / keyboard / touch input for `timeoutSec` AND
 *   - either presence detection is unavailable, OR the presence API reports
 *     the viewer is no longer looking.
 *
 * Lifts immediately on any input or when presence comes back.
 *
 * What it shows is configurable: a clock, a slowly fading slideshow of media
 * assets, a single still image, or a black screen.
 */

import { useEffect, useRef, useState } from "react"
import { ClockWidget, type ClockStyle } from "@/components/clock-widget"
import { MediaImage } from "@/components/media-image"

export type ScreenSaverContent = "clock" | "slideshow" | "image" | "black"

export interface ScreenSaverConfig {
  enabled: boolean
  timeoutSec: number
  content: ScreenSaverContent
  imageUrl?: string
  slideshowMediaIds?: number[]
  /** Slideshow seconds-per-slide. */
  slideshowInterval?: number
  /** Optional clock-style override when content === "clock". */
  clockStyle?: ClockStyle
  /** When true, also use camera presence (if available) to lock sooner. */
  usePresence?: boolean
}

const DEFAULT_CONFIG: ScreenSaverConfig = {
  enabled: false,
  timeoutSec: 120,
  content: "clock",
  slideshowInterval: 8,
  clockStyle: "minimal",
  usePresence: true,
}

export function loadScreenSaverConfig(value: unknown): ScreenSaverConfig {
  if (!value || typeof value !== "object") return { ...DEFAULT_CONFIG }
  const v = value as Partial<ScreenSaverConfig>
  return { ...DEFAULT_CONFIG, ...v }
}

interface PresenceState {
  looking: boolean
  enabled: boolean
}

export function ScreenSaver({ config }: { config: ScreenSaverConfig }) {
  const [active, setActive] = useState(false)
  const [presence, setPresence] = useState<PresenceState | null>(null)
  const lastActivity = useRef(Date.now())

  // 1) Track user input to know when the device went idle.
  useEffect(() => {
    if (!config.enabled) return
    const bump = () => {
      lastActivity.current = Date.now()
      if (active) setActive(false)
    }
    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"]
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, bump))
  }, [config.enabled, active])

  // 2) Poll presence (camera). Optional — works without it.
  useEffect(() => {
    if (!config.enabled || !config.usePresence) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as PresenceState
        if (!cancelled) setPresence(data)
      } catch { /* network blip — leave previous state */ }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [config.enabled, config.usePresence])

  // 3) Decide every second whether to engage the saver.
  //
  // Two trigger modes — both gated by `config.enabled`:
  //   - Camera mode (when usePresence is on AND the detector is reporting):
  //     lock a few seconds after the camera says nobody is looking. Stays
  //     unlocked while a viewer is present regardless of mouse idleness.
  //   - Idle mode (no camera, or camera disabled): pure browser-input idle
  //     timer; lock once `idleSec >= timeoutSec`.
  useEffect(() => {
    if (!config.enabled) { setActive(false); return }
    const id = setInterval(() => {
      const idleMs = Date.now() - lastActivity.current
      const idleSec = idleMs / 1000

      if (config.usePresence && presence?.enabled) {
        // Camera authoritative: someone in front → never lock; nobody → 5s grace.
        if (presence.looking) {
          if (active) setActive(false)
        } else if (!active && idleSec >= 5) {
          setActive(true)
        }
        return
      }

      // No camera signal: pure idle timer.
      if (!active && idleSec >= config.timeoutSec) setActive(true)
    }, 1000)
    return () => clearInterval(id)
  }, [active, config.enabled, config.timeoutSec, config.usePresence, presence])

  if (!config.enabled || !active) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black tile-theme-dark animate-fade-in-up"
      onClick={() => setActive(false)}
      role="presentation"
    >
      <ScreenSaverContentBody config={config} />
    </div>
  )
}

function ScreenSaverContentBody({ config }: { config: ScreenSaverConfig }) {
  if (config.content === "black") return null
  if (config.content === "image" && config.imageUrl) {
    return (
      <MediaImage src={config.imageUrl} className="h-full w-full object-cover" />
    )
  }
  if (config.content === "slideshow" && config.slideshowMediaIds?.length) {
    return <Slideshow ids={config.slideshowMediaIds} interval={config.slideshowInterval ?? 8} />
  }
  // default → clock
  return (
    <div className="h-full w-full">
      <ClockWidget style={config.clockStyle ?? "minimal"} format="24h" showSeconds={false} showDate={true} dateFormat="long" />
    </div>
  )
}

function Slideshow({ ids, interval }: { ids: number[]; interval: number }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (ids.length <= 1) return
    const id = setInterval(() => setIdx((i) => (i + 1) % ids.length), Math.max(2, interval) * 1000)
    return () => clearInterval(id)
  }, [ids.length, interval])
  const current = ids[idx % ids.length]
  return (
    <div className="relative h-full w-full">
      <MediaImage
        key={current}
        src={`/api/media/${current}`}
        className="absolute inset-0 h-full w-full object-cover animate-fade-in-up"
      />
    </div>
  )
}
