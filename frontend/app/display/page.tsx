"use client"

import { useEffect, useState } from "react"
import { DisplayCanvas } from "@/components/display-canvas"
import { LockScreen } from "@/components/lock-screen"

const PRESENCE_POLL_MS = 1500

type PresenceState = {
  looking: boolean
  enabled: boolean
  last_seen: number | null
  updated_at: number
  source: string | null
}

export default function DisplayPage() {
  const [presence, setPresence] = useState<PresenceState | null>(null)

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

  // Poll presence state so the lock screen lifts when a viewer is detected.
  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch("/api/presence", { cache: "no-store" })
        if (!res.ok) return
        const data: PresenceState = await res.json()
        if (!cancelled) setPresence(data)
      } catch {
        /* detector may not be running — just leave lock screen hidden */
      }
    }
    tick()
    const id = setInterval(tick, PRESENCE_POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Lock screen only engages when presence tracking is actively enabled AND
  // the detector reports nobody looking. Otherwise the notices stay on screen.
  const showLock = !!presence && presence.enabled && !presence.looking
  const looking = !!presence?.looking

  // Screen Wake Lock: as long as someone is looking at the display, hold an
  // OS-level wake lock so the monitor doesn't blank. Release it when they
  // walk away - the lock screen itself is fine to let the system sleep.
  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    // Feature-detect: Screen Wake Lock API is in Chromium/Edge/Safari 16+.
    const wl = (nav as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } })?.wakeLock
    if (!wl) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        sentinel = await wl!.request("screen")
        // Chromium drops the lock if the tab loses visibility - reacquire on
        // return so a brief focus swap doesn't let the monitor blank.
        sentinel?.addEventListener("release", () => { sentinel = null })
      } catch {
        /* user-gesture or policy refused - best effort */
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
      <LockScreen visible={showLock} />
    </div>
  )
}
