"use client"

import { useState } from "react"
import type { GridSpec } from "@/lib/grid-engine"

// Curated preset list — one entry per visually distinct aspect ratio.
const RESOLUTION_PRESETS = [
  { label: "16:9 HD",       cols: 16, rows: 9,  icon: "🖥️" },
  { label: "16:9 Dense",    cols: 24, rows: 14, icon: "📺" },
  { label: "21:9 Ultrawide", cols: 21, rows: 9,  icon: "🖥️" },
  { label: "4:3 Tablet",    cols: 12, rows: 9,  icon: "📱" },
  { label: "1:1 Square",    cols: 12, rows: 12, icon: "⬜" },
  { label: "9:16 Portrait", cols: 9,  rows: 16, icon: "📱" },
  { label: "3:1 Banner",    cols: 18, rows: 6,  icon: "📢" },
] as const

interface Props {
  spec: GridSpec
  tileCount: number
  onUpdate: (patch: { grid_cols?: number; grid_rows?: number; gap_px?: number }) => void
  onAutoFit?: () => void
}

/**
 * Pick a grid that matches the device's aspect ratio and resolution density.
 * Higher resolution → more cells (a 4K display gets a denser grid than 720p).
 * Returns cols/rows clamped to the schema's [1, 24] range.
 */
function autoGridForResolution(width: number, height: number): { cols: number; rows: number; label: string } {
  const aspect = width / height
  // Pick a target column count based on the longer-axis pixel size.
  const longSide = Math.max(width, height)
  let baseCols: number
  if      (longSide >= 3200) baseCols = 24   // 4K+
  else if (longSide >= 2400) baseCols = 20   // QHD/1440p
  else if (longSide >= 1600) baseCols = 16   // 1080p
  else if (longSide >= 1200) baseCols = 12   // 720p / tablet
  else                       baseCols = 10   // small

  // Map to landscape vs portrait.
  let cols: number, rows: number
  if (aspect >= 1) {
    cols = baseCols
    rows = Math.max(4, Math.min(24, Math.round(cols / aspect)))
  } else {
    rows = baseCols
    cols = Math.max(4, Math.min(24, Math.round(rows * aspect)))
  }
  return { cols, rows, label: `${width}×${height} → ${cols}×${rows}` }
}

function StepField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-600 dark:text-zinc-400 w-14">{label}</span>
      <div className="flex items-center rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
        <button onClick={() => value > min && onChange(value - 1)} disabled={value <= min}
          className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 border-r border-zinc-300 dark:border-zinc-700">&minus;</button>
        <input
          type="number" value={value} min={min} max={max}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
          }}
          className="w-12 bg-transparent px-1 py-1 text-center text-xs tabular-nums text-zinc-800 dark:text-zinc-200 outline-none"
        />
        <button onClick={() => value < max && onChange(value + 1)} disabled={value >= max}
          className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 border-l border-zinc-300 dark:border-zinc-700">+</button>
      </div>
    </div>
  )
}

export function GridSettingsPanel({ spec, tileCount, onUpdate, onAutoFit }: Props) {
  const [syncState, setSyncState] = useState<"idle" | "loading" | "done" | "none">("idle")
  const [syncLabel, setSyncLabel] = useState("")

  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const g = gcd(spec.cols, spec.rows)
  const simplifiedAspect = `${spec.cols / g}:${spec.rows / g}`

  async function syncFromDisplay() {
    setSyncState("loading")
    try {
      const res = await fetch("/api/display/resolution")
      const data = await res.json()
      if (!data.width || !data.height) {
        setSyncState("none")
        setSyncLabel("No display has connected yet")
        setTimeout(() => setSyncState("idle"), 3000)
        return
      }
      const auto = autoGridForResolution(data.width, data.height)
      onUpdate({ grid_cols: auto.cols, grid_rows: auto.rows })
      setSyncLabel(auto.label)
      setSyncState("done")
      setTimeout(() => setSyncState("idle"), 3000)
    } catch {
      setSyncState("idle")
    }
  }

  function syncFromBrowser() {
    const auto = autoGridForResolution(window.screen.width, window.screen.height)
    onUpdate({ grid_cols: auto.cols, grid_rows: auto.rows })
    setSyncLabel(`This screen → ${auto.cols}×${auto.rows}`)
    setSyncState("done")
    setTimeout(() => setSyncState("idle"), 3000)
  }

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
      {/* Manual controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <StepField label="Columns" value={spec.cols} min={1} max={24} onChange={(v) => onUpdate({ grid_cols: v })} />
        <StepField label="Rows" value={spec.rows} min={1} max={24} onChange={(v) => onUpdate({ grid_rows: v })} />
        <StepField label="Gap (px)" value={spec.gapPx} min={0} max={32} onChange={(v) => onUpdate({ gap_px: v })} />

        <div className="h-5 w-px bg-zinc-100 dark:bg-zinc-800" />

        <button
          onClick={syncFromDisplay}
          disabled={syncState === "loading"}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors border ${
            syncState === "done"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : syncState === "none"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          } disabled:opacity-50`}
          title="Auto-detect from the display device's reported resolution"
        >
          {syncState === "loading" ? (
            <span className="animate-spin inline-block h-2.5 w-2.5 rounded-full border border-zinc-400 dark:border-zinc-600 border-t-zinc-300" />
          ) : (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          )}
          {syncState === "done" || syncState === "none" ? syncLabel : "Auto from Display"}
        </button>

        <button
          onClick={syncFromBrowser}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          title="Use this browser window's screen size"
        >
          Auto from Browser
        </button>

        {onAutoFit && (
          <button
            onClick={onAutoFit}
            disabled={tileCount === 0}
            className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-40"
            title="Auto-arrange every tile to fit the grid with no overlaps"
          >
            ✨ Auto-Fit Tiles
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <span className="tabular-nums">{spec.cols * spec.rows} cells</span>
          <span>&middot;</span>
          <span className="tabular-nums">{tileCount} tiles</span>
          <span>&middot;</span>
          <span className="text-zinc-600">{simplifiedAspect} aspect</span>
        </div>
      </div>

      {/* Resolution presets */}
      <div className="flex items-center gap-1 border-t border-zinc-200/50 dark:border-zinc-800/50 px-4 py-2 overflow-x-auto">
        <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 shrink-0">Presets</span>
        {RESOLUTION_PRESETS.map((preset) => {
          const isActive = spec.cols === preset.cols && spec.rows === preset.rows
          return (
            <button
              key={preset.label}
              onClick={() => onUpdate({ grid_cols: preset.cols, grid_rows: preset.rows })}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                isActive
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span className="mr-1">{preset.icon}</span>
              {preset.label}
              <span className="ml-1.5 text-[9px] text-zinc-600 tabular-nums">{preset.cols}×{preset.rows}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
