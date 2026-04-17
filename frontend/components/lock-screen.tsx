"use client"

import { useEffect, useMemo, useState } from "react"

/**
 * Full-screen overlay shown on the display while no viewer is detected.
 * It lifts (fades out) as soon as the backend reports `looking=true`.
 *
 * Visual direction: Las-Vegas-Sphere-ish. A giant glowing orb, a slow-rotating
 * ring of emojis around it, drifting emoji particles in the background, and a
 * hue-shifting gradient behind everything. All CSS - no canvas, no libraries.
 */

// Emojis that orbit around the central sphere (rotating ring).
const ORBIT_EMOJIS = ["📣", "📚", "🎓", "🔔", "🗓️", "🏫", "✨", "📰", "🎉", "🧪"]

// Emojis that drift up from the bottom like slow confetti.
const DRIFT_EMOJIS = ["✨", "💫", "⭐", "🌟", "🎆", "🎇", "🔮", "🎨", "🪩", "🌈"]

type Drifter = { emoji: string; left: number; delay: number; duration: number; size: number }

function makeDrifters(count: number): Drifter[] {
  const out: Drifter[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      emoji: DRIFT_EMOJIS[Math.floor(Math.random() * DRIFT_EMOJIS.length)],
      left: Math.random() * 100,
      delay: -Math.random() * 12,     // negative delay = already in-flight on mount
      duration: 10 + Math.random() * 10,
      size: 1.5 + Math.random() * 2.5, // rem
    })
  }
  return out
}

export function LockScreen({ visible }: { visible: boolean }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Generate drifters once per mount so their random positions stay stable
  // across re-renders. Regenerated if the component remounts.
  const drifters = useMemo(() => makeDrifters(22), [])

  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""
  const date = now
    ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : ""

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[9999] overflow-hidden bg-black text-white transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      {/* Slow hue-shifting neon gradient base - the "sphere skin" lighting */}
      <div className="absolute inset-0 animate-ls-hue opacity-60"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.35), transparent 55%),"
            + "radial-gradient(circle at 70% 70%, rgba(168,85,247,0.35), transparent 55%),"
            + "radial-gradient(circle at 50% 90%, rgba(236,72,153,0.25), transparent 60%)",
        }}
      />

      {/* Drifting background emojis */}
      <div className="absolute inset-0">
        {drifters.map((d, i) => (
          <span
            key={i}
            className="absolute bottom-[-10%] animate-ls-drift"
            style={{
              left:            `${d.left}%`,
              fontSize:        `${d.size}rem`,
              animationDelay:  `${d.delay}s`,
              animationDuration: `${d.duration}s`,
              filter: "drop-shadow(0 0 12px rgba(255,255,255,0.25))",
            }}
          >
            {d.emoji}
          </span>
        ))}
      </div>

      {/* The giant sphere behind the clock - pulsing, hue-shifting, ringed */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="h-[70vmin] w-[70vmin] rounded-full animate-ls-pulse"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 30%, transparent 60%),"
              + "conic-gradient(from 0deg, #38bdf8, #a855f7, #ec4899, #f59e0b, #38bdf8)",
            boxShadow:
              "0 0 120px 20px rgba(168,85,247,0.35), inset 0 0 80px rgba(255,255,255,0.08)",
          }}
        />
      </div>

      {/* Orbiting emoji ring.
          Outer "spoke" carries a static rotate-then-translate so each emoji
          lands on its position on the ring. The parent spins; the emojis ride
          with it. We could counter-rotate to keep them upright, but an
          orbiting animation on transform would clobber the positional
          transform, and the "tumbling" look works fine here. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-[85vmin] w-[85vmin] animate-ls-spin">
          {ORBIT_EMOJIS.map((e, i) => {
            const angle = (360 / ORBIT_EMOJIS.length) * i
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{ transform: `rotate(${angle}deg) translateY(-42.5vmin)` }}
              >
                <span
                  className="block -translate-x-1/2 -translate-y-1/2 text-5xl"
                  style={{ filter: "drop-shadow(0 0 10px rgba(56,189,248,0.6))" }}
                >
                  {e}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Foreground clock + tagline */}
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6">
        <p
          className="text-[14vw] font-black leading-none tabular-nums tracking-tight animate-ls-glow"
          style={{
            background: "linear-gradient(90deg,#60a5fa,#c084fc,#f472b6,#fbbf24,#60a5fa)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {time}
        </p>
        <p className="text-3xl font-semibold text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
          {date}
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.5em] text-white/60">
          <span className="mr-2 inline-block animate-ls-bounce">👀</span>
          step closer to view notices
          <span className="ml-2 inline-block animate-ls-bounce">👀</span>
        </p>
      </div>

      {/* Local keyframes - scoped to this component via a <style> tag so we
          don't have to edit tailwind.config for a screen that only exists
          here. The 'ls-' prefix keeps names from clashing. */}
      <style>{`
        @keyframes ls-hue       { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
        @keyframes ls-spin      { 0% { transform: rotate(0deg); }  100% { transform: rotate(360deg); } }
        @keyframes ls-pulse     {
          0%,100% { transform: scale(1);    filter: hue-rotate(0deg)   brightness(1); }
          50%     { transform: scale(1.05); filter: hue-rotate(120deg) brightness(1.15); }
        }
        @keyframes ls-drift     {
          0%   { transform: translateY(0)      rotate(0deg);   opacity: 0; }
          10%  { opacity: 0.9; }
          90%  { opacity: 0.9; }
          100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
        }
        @keyframes ls-glow      {
          0%,100% { background-position:   0% 50%; }
          50%     { background-position: 200% 50%; }
        }
        @keyframes ls-bounce    {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-4px); }
        }
        .animate-ls-hue         { animation: ls-hue 20s linear infinite; }
        .animate-ls-spin        { animation: ls-spin 45s linear infinite; }
        .animate-ls-pulse       { animation: ls-pulse 6s ease-in-out infinite; }
        .animate-ls-drift       { animation-name: ls-drift; animation-timing-function: linear; animation-iteration-count: infinite; }
        .animate-ls-glow        { animation: ls-glow 6s linear infinite; }
        .animate-ls-bounce      { animation: ls-bounce 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
