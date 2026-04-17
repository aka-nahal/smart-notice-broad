"use client"

import { useEffect, useState } from "react"

/**
 * Full-screen overlay shown on the display while no viewer is detected.
 * It lifts (fades out) as soon as the backend reports `looking=true`.
 *
 * Rendered only when `visible` is true so the notice board underneath stays
 * fully interactive the rest of the time.
 */
export function LockScreen({ visible }: { visible: boolean }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""
  const date = now
    ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : ""

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.25), transparent 60%), radial-gradient(circle at 70% 70%, rgba(168,85,247,0.2), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-6">
        <p className="text-[12vw] font-bold leading-none tabular-nums tracking-tight">
          {time}
        </p>
        <p className="text-2xl text-zinc-300">{date}</p>
        <p className="mt-8 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Step closer to view notices
        </p>
      </div>
    </div>
  )
}
