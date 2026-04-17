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

  return (
    // force-dark keeps the display board dark regardless of admin theme preference
    <div className="force-dark fixed inset-0">
      <DisplayCanvas />
      <LockScreen visible={showLock} />
    </div>
  )
}
