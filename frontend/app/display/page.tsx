"use client"

import { useEffect, useState } from "react"
import { DisplayCanvas } from "@/components/display-canvas"

const PRESENCE_POLL_MS = 1500

type PresenceState = {
  looking: boolean
  enabled: boolean
  last_seen: number | null
  updated_at: number
  source: string | null
}

export default function DisplayPage() {
  const [looking, setLooking] = useState<boolean>(true)

  // Report screen resolution to the backend so the builder can auto-assign grid
  useEffect(() => {
    fetch("/api/display/resolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        width:  window.screen.width,
        height: window.screen.height,
        dpr:    window.devicePixelRatio || 1,
      }),
    }).catch(() => {/* non-critical */})
  }, [])

  // Poll presence — used only to drive the OS-level wake lock now. The visible
  // lock-screen overlay is handled by the configurable ScreenSaver inside the
  // DisplayCanvas, which honors the admin's "Screen Saver" settings.
  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" })
        if (!res.ok) return
        const data: PresenceState = await res.json()
        if (!cancelled) setLooking(!data.enabled || data.looking)
      } catch {
        /* detector may not be running — keep wake lock optimistic */
      }
    }
    tick()
    const id = setInterval(tick, PRESENCE_POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Screen Wake Lock: as long as someone is looking at the display, hold an
  // OS-level wake lock so the monitor doesn't blank.
  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    const wl = (nav as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } })?.wakeLock
    if (!wl) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        sentinel = await wl!.request("screen")
        sentinel?.addEventListener("release", () => { sentinel = null })
      } catch {
        /* user-gesture or policy refused — best effort */
      }
    }

    async function release() {
      try { await sentinel?.release() } catch { /* ignore */ }
      sentinel = null
    }

    if (looking) {
      acquire()
      const onVis = () => {
        if (!cancelled && document.visibilityState === "visible" && looking && !sentinel) {
          acquire()
        }
      }
      document.addEventListener("visibilitychange", onVis)
      return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); release() }
    } else {
      release()
    }
  }, [looking])

  return (
    // force-dark keeps the display board dark regardless of admin theme preference
    <div className="force-dark fixed inset-0">
      <DisplayCanvas />
    </div>
  )
}
