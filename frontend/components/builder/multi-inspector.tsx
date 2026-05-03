"use client"

import { useState } from "react"
import type { TileRead, TileUpdate } from "@/lib/types"
import { TILE_TYPES } from "@/lib/types"

interface Props {
  count: number
  selectedTiles: TileRead[]
  onDelete: () => void
  onDuplicate: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onBulkUpdate: (field: keyof TileUpdate, value: number | string | boolean | null) => void
}

export function MultiInspector({ count, selectedTiles, onDelete, onDuplicate, onBringToFront, onSendToBack, onBulkUpdate }: Props) {
  const [showBulk, setShowBulk] = useState(false)

  // Compute shared properties
  const allSameType = selectedTiles.every((t) => t.tile_type === selectedTiles[0]?.tile_type)
  const typeInfo = allSameType ? TILE_TYPES.find((t) => t.value === selectedTiles[0]?.tile_type) : null
  const totalArea = selectedTiles.reduce((s, t) => s + t.grid_w * t.grid_h, 0)
  const hasEmergency = selectedTiles.some((t) => t.is_emergency_slot)
  const allEmergency = selectedTiles.every((t) => t.is_emergency_slot)

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-sm font-bold text-blue-400">{count}</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{count} tiles selected</p>
          <p className="text-[10px] text-zinc-600">
            {allSameType ? `All ${typeInfo?.label ?? selectedTiles[0]?.tile_type}` : "Mixed types"}
            {" · "}{totalArea} cells
          </p>
        </div>
      </div>

      {/* Selection summary */}
      <div className="rounded-lg bg-zinc-100/30 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {selectedTiles.map((t) => {
            const info = TILE_TYPES.find((tt) => tt.value === t.tile_type)
            return (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                <span>{info?.icon ?? "?"}</span>
                #{t.id}
                <span className="text-zinc-600">{t.grid_w}×{t.grid_h}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1.5">Actions</p>
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn icon="📋" label="Duplicate All" onClick={onDuplicate} />
          <ActionBtn icon="⬆️" label="Bring to Front" onClick={onBringToFront} />
          <ActionBtn icon="⬇️" label="Send to Back" onClick={onSendToBack} />
          <ActionBtn icon="🗑️" label="Delete All" onClick={onDelete} danger />
        </div>
      </div>

      {/* Bulk editing */}
      <div className="space-y-1">
        <button
          onClick={() => setShowBulk((v) => !v)}
          className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 py-1"
        >
          Bulk Edit
          <span className={`transition-transform ${showBulk ? "rotate-180" : ""}`}>▼</span>
        </button>

        {showBulk && (
          <div className="space-y-2.5 pt-1">
            {/* Bulk type change */}
            {allSameType && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Change All Types</span>
                <select
                  value={selectedTiles[0]?.tile_type ?? ""}
                  onChange={(e) => onBulkUpdate("tile_type", e.target.value)}
                  className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50"
                >
                  {TILE_TYPES.map((tt) => (
                    <option key={tt.value} value={tt.value}>{tt.icon} {tt.label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Bulk priority */}
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Set All Priority Weight</span>
              <input
                type="number" min={0} max={100} placeholder="0-100"
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  if (!isNaN(n)) onBulkUpdate("priority_weight", Math.max(0, Math.min(100, n)))
                }}
                className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50 tabular-nums"
              />
            </label>

            {/* Bulk emergency toggle */}
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={allEmergency}
                onChange={(e) => onBulkUpdate("is_emergency_slot", e.target.checked)}
                className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-red-500"
              />
              {allEmergency ? "Disable all emergency slots" : hasEmergency ? "Some are emergency slots" : "Mark all as emergency"}
            </label>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-lg bg-zinc-100/20 dark:bg-zinc-800/20 border border-zinc-200 dark:border-zinc-800 p-2.5 text-[10px] text-zinc-600 space-y-1">
        <p>Use the <strong className="text-zinc-500">Align toolbar</strong> above the canvas.</p>
        <p><kbd className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 text-zinc-500">↑↓←→</kbd> Nudge all selected tiles</p>
        <p><kbd className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 text-zinc-500">Shift+Click</kbd> Toggle selection</p>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 py-2 px-2 text-[11px] border border-zinc-300 dark:border-zinc-700 transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-900/20 hover:border-red-500/30"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
      }`}>
      <span className="text-xs">{icon}</span>
      {label}
    </button>
  )
}
