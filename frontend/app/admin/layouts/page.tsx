"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import api from "@/lib/api-client"
import type { LayoutRead, TileCreate } from "@/lib/types"

// ---------------------------------------------------------------------------
// Layout presets
// ---------------------------------------------------------------------------

interface LayoutPreset {
  name: string
  description: string
  icon: string
  cols: number
  rows: number
  gap: number
  tiles: Omit<TileCreate, "z_index">[]
}

const PRESETS: LayoutPreset[] = [
  {
    name: "Daily Board",
    description: "Standard notice board with banner, notices, and clock",
    icon: "📋",
    cols: 16, rows: 9, gap: 8,
    tiles: [
      { tile_type: "banner", grid_x: 0, grid_y: 0, grid_w: 16, grid_h: 2, config_json: JSON.stringify({ bannerTitle: "Smart Notice Board", bannerSubtitle: "Campus Display System" }) },
      { tile_type: "notice", grid_x: 0, grid_y: 2, grid_w: 5, grid_h: 4 },
      { tile_type: "notice", grid_x: 5, grid_y: 2, grid_w: 5, grid_h: 4 },
      { tile_type: "image", grid_x: 10, grid_y: 2, grid_w: 6, grid_h: 4 },
      { tile_type: "clock", grid_x: 0, grid_y: 6, grid_w: 3, grid_h: 2 },
      { tile_type: "weather", grid_x: 3, grid_y: 6, grid_w: 4, grid_h: 2, config_json: JSON.stringify({ weatherCity: "London", weatherUnits: "metric" }) },
      { tile_type: "ticker", grid_x: 7, grid_y: 8, grid_w: 9, grid_h: 1 },
    ],
  },
  {
    name: "Festival / Event",
    description: "Large visuals and video with event announcements",
    icon: "🎪",
    cols: 12, rows: 12, gap: 8,
    tiles: [
      { tile_type: "banner", grid_x: 0, grid_y: 0, grid_w: 12, grid_h: 3, config_json: JSON.stringify({ bannerTitle: "Annual Festival 2026", bannerSubtitle: "Join us for an amazing celebration!" }) },
      { tile_type: "video", grid_x: 0, grid_y: 3, grid_w: 6, grid_h: 5 },
      { tile_type: "image", grid_x: 6, grid_y: 3, grid_w: 6, grid_h: 5 },
      { tile_type: "notice", grid_x: 0, grid_y: 8, grid_w: 4, grid_h: 4 },
      { tile_type: "notice", grid_x: 4, grid_y: 8, grid_w: 4, grid_h: 4 },
      { tile_type: "notice", grid_x: 8, grid_y: 8, grid_w: 4, grid_h: 4 },
    ],
  },
  {
    name: "Celebration",
    description: "Big banner with images for celebrations",
    icon: "🎉",
    cols: 12, rows: 8, gap: 8,
    tiles: [
      { tile_type: "banner", grid_x: 0, grid_y: 0, grid_w: 12, grid_h: 3, config_json: JSON.stringify({ bannerTitle: "Congratulations!", bannerSubtitle: "Celebrating our achievements" }) },
      { tile_type: "image", grid_x: 0, grid_y: 3, grid_w: 4, grid_h: 5 },
      { tile_type: "image", grid_x: 4, grid_y: 3, grid_w: 4, grid_h: 5 },
      { tile_type: "image", grid_x: 8, grid_y: 3, grid_w: 4, grid_h: 5 },
    ],
  },
  {
    name: "Emergency Alert",
    description: "Full-screen emergency broadcast layout",
    icon: "🚨",
    cols: 16, rows: 9, gap: 4,
    tiles: [
      { tile_type: "emergency", grid_x: 0, grid_y: 0, grid_w: 16, grid_h: 7, is_emergency_slot: true },
      { tile_type: "ticker", grid_x: 0, grid_y: 7, grid_w: 12, grid_h: 1, config_json: JSON.stringify({ tickerText: "EMERGENCY ALERT — Please follow instructions" }) },
      { tile_type: "clock", grid_x: 12, grid_y: 7, grid_w: 4, grid_h: 2 },
    ],
  },
  {
    name: "Minimal / Kiosk",
    description: "Clean, simple layout for small displays",
    icon: "📱",
    cols: 6, rows: 4, gap: 8,
    tiles: [
      { tile_type: "notice", grid_x: 0, grid_y: 0, grid_w: 4, grid_h: 3 },
      { tile_type: "clock", grid_x: 4, grid_y: 0, grid_w: 2, grid_h: 2 },
      { tile_type: "ticker", grid_x: 0, grid_y: 3, grid_w: 6, grid_h: 1 },
    ],
  },
  {
    name: "Widescreen / Ultrawide",
    description: "Ultra-wide panoramic display layout",
    icon: "🖥️",
    cols: 21, rows: 9, gap: 6,
    tiles: [
      { tile_type: "banner", grid_x: 0, grid_y: 0, grid_w: 21, grid_h: 2, config_json: JSON.stringify({ bannerTitle: "Information Display" }) },
      { tile_type: "notice", grid_x: 0, grid_y: 2, grid_w: 5, grid_h: 5 },
      { tile_type: "notice", grid_x: 5, grid_y: 2, grid_w: 5, grid_h: 5 },
      { tile_type: "image", grid_x: 10, grid_y: 2, grid_w: 6, grid_h: 5 },
      { tile_type: "clock", grid_x: 16, grid_y: 2, grid_w: 5, grid_h: 3 },
      { tile_type: "notice", grid_x: 16, grid_y: 5, grid_w: 5, grid_h: 2 },
      { tile_type: "ticker", grid_x: 0, grid_y: 7, grid_w: 21, grid_h: 1 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LayoutsPage() {
  const [layouts, setLayouts] = useState<LayoutRead[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newCols, setNewCols] = useState(12)
  const [newRows, setNewRows] = useState(8)
  const [newGap, setNewGap] = useState(8)

  // Rename state
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")

  async function load() {
    try {
      const lays = await api.layouts.list()
      setLayouts(lays)
    } catch (e) {
      console.error("Load failed", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function createFromPreset(preset: LayoutPreset) {
    setCreating(true)
    try {
      const layout = await api.layouts.create({
        name: preset.name,
        description: preset.description,
        grid_cols: preset.cols,
        grid_rows: preset.rows,
        gap_px: preset.gap,
      })
      const ver = layout.versions[0]
      if (ver) {
        for (let i = 0; i < preset.tiles.length; i++) {
          await api.tiles.create(layout.id, ver.id, { ...preset.tiles[i], z_index: i })
        }
      }
      await load()
      setShowCreate(false)
    } catch (e) {
      console.error("Create failed", e)
    } finally {
      setCreating(false)
    }
  }

  async function createCustom() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.layouts.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        grid_cols: newCols,
        grid_rows: newRows,
        gap_px: newGap,
      })
      await load()
      setShowCreate(false)
      setNewName(""); setNewDesc(""); setNewCols(12); setNewRows(8); setNewGap(8)
    } catch (e) {
      console.error("Create failed", e)
    } finally {
      setCreating(false)
    }
  }

  async function deleteLayout(id: number) {
    if (!confirm("Delete this layout and all its versions?")) return
    try {
      await api.layouts.delete(id)
      setLayouts((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      console.error("Delete failed", e)
    }
  }

  async function setActive(layout: LayoutRead) {
    const latestVer = layout.versions[0]
    if (!latestVer) return
    try {
      await api.versions.publish(layout.id, latestVer.id)
      await load()
    } catch (e) {
      console.error("Publish failed", e)
    }
  }

  async function duplicateLayout(layout: LayoutRead) {
    try {
      const newLayout = await api.layouts.create({
        name: `${layout.name} (Copy)`,
        description: layout.description ?? undefined,
        grid_cols: layout.versions[0]?.grid_cols ?? 12,
        grid_rows: layout.versions[0]?.grid_rows ?? 8,
        gap_px: layout.versions[0]?.gap_px ?? 8,
      })
      const srcVer = layout.versions[0]
      const dstVer = newLayout.versions[0]
      if (srcVer && dstVer) {
        for (const t of srcVer.tiles) {
          await api.tiles.create(newLayout.id, dstVer.id, {
            tile_type: t.tile_type, grid_x: t.grid_x, grid_y: t.grid_y,
            grid_w: t.grid_w, grid_h: t.grid_h, z_index: t.z_index,
            notice_id: t.notice_id, config_json: t.config_json,
          })
        }
      }
      await load()
    } catch (e) {
      console.error("Duplicate failed", e)
    }
  }

  async function saveRename(id: number) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    try {
      await api.layouts.update(id, { name: renameValue.trim() })
      await load()
    } catch (e) {
      console.error("Rename failed", e)
    }
    setRenamingId(null)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Layouts</h1>
          <p className="mt-1 text-sm text-zinc-500">Create and manage display layouts for different scenarios</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20">
          + New Layout
        </button>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Create New Layout</h2>
            <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">&times;</button>
          </div>

          {/* Presets grid */}
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Quick Start Presets</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => createFromPreset(preset)}
                disabled={creating}
                className="group rounded-xl border border-zinc-200 dark:border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-100/50 dark:bg-zinc-800/50 p-4 text-left transition-all hover:border-blue-500/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-500 dark:group-hover:text-blue-400">{preset.name}</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-snug">{preset.description}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-600">
                  <span>{preset.cols}×{preset.rows}</span>
                  <span>·</span>
                  <span>{preset.tiles.length} tiles</span>
                </div>
                {/* Mini preview */}
                <div className="mt-2 relative h-8 rounded border border-zinc-200 dark:border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
                  {preset.tiles.map((t, i) => (
                    <div key={i} className="absolute bg-zinc-400/40 dark:bg-zinc-600/40 rounded-[1px]" style={{
                      left: `${(t.grid_x / preset.cols) * 100}%`,
                      top: `${(t.grid_y / preset.rows) * 100}%`,
                      width: `${(t.grid_w / preset.cols) * 100}%`,
                      height: `${(t.grid_h / preset.rows) * 100}%`,
                    }} />
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Custom layout form */}
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Or Custom Layout</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Layout"
                className="rounded-md bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50 w-48" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Description</span>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional"
                className="rounded-md bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50 w-48" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Cols</span>
              <input type="number" value={newCols} min={1} max={24} onChange={(e) => setNewCols(+e.target.value)}
                className="rounded-md bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 w-16 tabular-nums" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Rows</span>
              <input type="number" value={newRows} min={1} max={24} onChange={(e) => setNewRows(+e.target.value)}
                className="rounded-md bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 w-16 tabular-nums" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Gap</span>
              <input type="number" value={newGap} min={0} max={32} onChange={(e) => setNewGap(+e.target.value)}
                className="rounded-md bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 w-16 tabular-nums" />
            </label>
            <button onClick={createCustom} disabled={!newName.trim() || creating}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Layout cards */}
      {layouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <span className="text-4xl block mb-3">📋</span>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No layouts yet.</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-1">Click &ldquo;+ New Layout&rdquo; to get started with a preset.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {layouts.map((layout) => {
            const published = layout.versions.find((v) => v.is_published)
            const ver = layout.versions[0]
            const tileCount = ver?.tiles.length ?? 0
            const isActive = !!published

            return (
              <div key={layout.id}
                className={`rounded-xl border bg-white/50 dark:bg-zinc-900/50 p-5 transition-all ${
                  isActive
                    ? "border-emerald-500/40"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    {renamingId === layout.id ? (
                      <input value={renameValue} autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => saveRename(layout.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveRename(layout.id); if (e.key === "Escape") setRenamingId(null) }}
                        className="w-full rounded bg-white dark:bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 outline-none border border-blue-500/50" />
                    ) : (
                      <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 truncate cursor-pointer hover:text-blue-500 dark:hover:text-blue-400"
                        onDoubleClick={() => { setRenamingId(layout.id); setRenameValue(layout.name) }}>
                        {layout.name}
                      </h3>
                    )}
                    {layout.description && <p className="mt-0.5 text-xs text-zinc-500 truncate">{layout.description}</p>}
                  </div>
                  {isActive && (
                    <span className="shrink-0 ml-2 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  )}
                </div>

                {/* Minimap */}
                {ver && (
                  <div className="relative h-16 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-white dark:bg-zinc-900 overflow-hidden mb-3">
                    {ver.tiles.map((t) => (
                      <div key={t.id} className={`absolute rounded-[2px] ${
                        t.tile_type === "banner" ? "bg-sky-500/40" :
                        t.tile_type === "emergency" ? "bg-red-500/40" :
                        t.tile_type === "clock" ? "bg-violet-500/40" :
                        t.tile_type === "image" ? "bg-emerald-500/40" :
                        t.tile_type === "ticker" ? "bg-amber-500/40" :
                        "bg-blue-500/40"
                      }`} style={{
                        left: `${(t.grid_x / ver.grid_cols) * 100}%`,
                        top: `${(t.grid_y / ver.grid_rows) * 100}%`,
                        width: `${(t.grid_w / ver.grid_cols) * 100}%`,
                        height: `${(t.grid_h / ver.grid_rows) * 100}%`,
                      }} />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                  <span>{layout.versions.length} ver{layout.versions.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{tileCount} tiles</span>
                  {ver && (<><span>·</span><span>{ver.grid_cols}×{ver.grid_rows}</span></>)}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                  <Link href={`/admin/builder?layout=${layout.id}`}
                    className="rounded-md bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20">
                    Edit in Builder
                  </Link>
                  {!isActive && (
                    <button onClick={() => setActive(layout)}
                      className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
                      Set as Active
                    </button>
                  )}
                  <button onClick={() => duplicateLayout(layout)}
                    className="rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-700 dark:text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                    Duplicate
                  </button>
                  <button onClick={() => { setRenamingId(layout.id); setRenameValue(layout.name) }}
                    className="rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-700 dark:text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                    Rename
                  </button>
                  <button onClick={() => deleteLayout(layout.id)}
                    className="rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/30">
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
