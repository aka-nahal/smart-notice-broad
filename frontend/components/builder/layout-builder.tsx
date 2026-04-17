"use client"

import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import type {
  LayoutRead, LayoutVersionRead, NoticeRead, TileRead,
  TileBulkUpdateItem, TileCreate, TileUpdate, InteractionMode, ContextMenuState,
} from "@/lib/types"
import { TILE_TYPES } from "@/lib/types"
import {
  rectsOverlap, isWithinBounds,
  alignLeft, alignRight, alignTop, alignBottom, distributeH, distributeV,
  autoFitRects, clampRectToSpec,
  type GridRect, type GridSpec,
} from "@/lib/grid-engine"
import api from "@/lib/api-client"
import { useSelection } from "@/hooks/use-selection"
import { useHistory } from "@/hooks/use-history"
import { useSaveState } from "@/hooks/use-save-state"
import { BuilderToolbar } from "./builder-toolbar"
import { GridSettingsPanel } from "./grid-settings-panel"
import { AlignToolbar } from "./align-toolbar"
import { TilePalette } from "./tile-palette"
import { BuilderCanvas } from "./builder-canvas"
import { TileInspector } from "./tile-inspector"
import { MultiInspector } from "./multi-inspector"
import { ContextMenu, type ContextMenuItem } from "./context-menu"
import { ToastProvider, useToast } from "./toast"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tileRect(t: TileRead): GridRect {
  return { x: t.grid_x, y: t.grid_y, w: t.grid_w, h: t.grid_h }
}

function collidesExcluding(rect: GridRect, tiles: TileRead[], excludeIds: Set<number>) {
  return tiles.some((t) => !excludeIds.has(t.id) && rectsOverlap(rect, tileRect(t)))
}

function findFirstEmpty(tiles: TileRead[], spec: GridSpec, w = 1, h = 1): { x: number; y: number } {
  for (let y = 0; y <= spec.rows - h; y++)
    for (let x = 0; x <= spec.cols - w; x++) {
      const rect: GridRect = { x, y, w, h }
      if (!tiles.some((t) => rectsOverlap(rect, tileRect(t)))) return { x, y }
    }
  return { x: 0, y: 0 }
}

function pixelToCell(
  clientX: number, clientY: number, gridEl: HTMLElement, spec: GridSpec, padding: number,
): { col: number; row: number } {
  const rect = gridEl.getBoundingClientRect()
  const innerW = rect.width - padding * 2
  const innerH = rect.height - padding * 2
  const cellW = (innerW - spec.gapPx * (spec.cols - 1)) / spec.cols
  const cellH = (innerH - spec.gapPx * (spec.rows - 1)) / spec.rows
  const relX = clientX - rect.left - padding
  const relY = clientY - rect.top - padding
  return {
    col: Math.max(0, Math.min(spec.cols - 1, Math.floor(relX / (cellW + spec.gapPx)))),
    row: Math.max(0, Math.min(spec.rows - 1, Math.floor(relY / (cellH + spec.gapPx)))),
  }
}

function tileAtCell(col: number, row: number, tiles: TileRead[]): TileRead | null {
  for (let i = tiles.length - 1; i >= 0; i--) {
    const t = tiles[i]
    if (col >= t.grid_x && col < t.grid_x + t.grid_w && row >= t.grid_y && row < t.grid_y + t.grid_h) return t
  }
  return null
}

/** Compute snap alignment guides for current ghost position */
function computeSnapGuides(ghost: GridRect | null, tiles: TileRead[], excludeIds: Set<number>): { type: "row" | "col"; pos: number }[] {
  if (!ghost) return []
  const guides: { type: "row" | "col"; pos: number }[] = []
  for (const t of tiles) {
    if (excludeIds.has(t.id)) continue
    // Left edge alignment
    if (ghost.x === t.grid_x) guides.push({ type: "col", pos: t.grid_x })
    // Right edge alignment
    if (ghost.x + ghost.w === t.grid_x + t.grid_w) guides.push({ type: "col", pos: t.grid_x + t.grid_w })
    // Top edge alignment
    if (ghost.y === t.grid_y) guides.push({ type: "row", pos: t.grid_y })
    // Bottom edge alignment
    if (ghost.y + ghost.h === t.grid_y + t.grid_h) guides.push({ type: "row", pos: t.grid_y + t.grid_h })
  }
  // Deduplicate
  const seen = new Set<string>()
  return guides.filter((g) => {
    const key = `${g.type}-${g.pos}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}

// ---------------------------------------------------------------------------
// Inner component (needs toast context)
// ---------------------------------------------------------------------------

function LayoutBuilderInner() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const layoutParam = searchParams.get("layout")

  // ---- Core state ----
  const [layouts, setLayouts] = useState<LayoutRead[]>([])
  const [activeLayout, setActiveLayout] = useState<LayoutRead | null>(null)
  const [version, setVersion] = useState<LayoutVersionRead | null>(null)
  const [tiles, setTiles] = useState<TileRead[]>([])
  const [notices, setNotices] = useState<NoticeRead[]>([])
  const [loading, setLoading] = useState(true)

  // ---- Extracted hooks ----
  const { selectedIds, select, toggle, selectAll, clear: clearSelection, setSelectedIds } = useSelection()
  const history = useHistory()
  const save = useSaveState()

  // ---- UI state ----
  const [showGridSettings, setShowGridSettings] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [mode, setMode] = useState<InteractionMode>({ kind: "idle" })
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set())

  // Track if a real drag happened (vs just a click)
  const dragStartCell = useRef<{ col: number; row: number } | null>(null)
  const hasDragged = useRef(false)

  const gridRef = useRef<HTMLDivElement>(null)

  const spec: GridSpec = version
    ? { cols: version.grid_cols, rows: version.grid_rows, gapPx: version.gap_px }
    : { cols: 12, rows: 8, gapPx: 8 }

  const selectedTiles = tiles.filter((t) => selectedIds.has(t.id))
  const singleSelected = selectedTiles.length === 1 ? selectedTiles[0] : null

  // ---- Ghost preview (drag-aware) ----
  const ghostRect: GridRect | null = (() => {
    if (!hoverCell) return null

    // Palette drop ghost
    if (mode.kind === "palette-drop") {
      const x = Math.max(0, Math.min(spec.cols - mode.w, hoverCell.col))
      const y = Math.max(0, Math.min(spec.rows - mode.h, hoverCell.row))
      return { x, y, w: mode.w, h: mode.h }
    }

    // Real drag ghost
    if (mode.kind === "dragging") {
      const tile = tiles.find((t) => t.id === mode.tileId)
      if (!tile) return null
      const x = Math.max(0, Math.min(spec.cols - tile.grid_w, hoverCell.col - mode.offsetCol))
      const y = Math.max(0, Math.min(spec.rows - tile.grid_h, hoverCell.row - mode.offsetRow))
      return { x, y, w: tile.grid_w, h: tile.grid_h }
    }

    // Real drag-resize ghost
    if (mode.kind === "drag-resize") {
      const tile = tiles.find((t) => t.id === mode.tileId)
      if (!tile) return null
      const h = mode.handle
      let x = tile.grid_x, y = tile.grid_y, w = tile.grid_w, ht = tile.grid_h
      if (h.includes("e")) w = Math.max(1, Math.min(spec.cols - x, hoverCell.col - x + 1))
      if (h.includes("s")) ht = Math.max(1, Math.min(spec.rows - y, hoverCell.row - y + 1))
      if (h.includes("w")) { const nx = Math.max(0, Math.min(hoverCell.col, tile.grid_x + tile.grid_w - 1)); w = tile.grid_x + tile.grid_w - nx; x = nx }
      if (h.includes("n")) { const ny = Math.max(0, Math.min(hoverCell.row, tile.grid_y + tile.grid_h - 1)); ht = tile.grid_y + tile.grid_h - ny; y = ny }
      return { x, y, w, h: ht }
    }

    // Legacy click-to-move/resize
    if (selectedTiles.length !== 1) return null
    const tile = selectedTiles[0]
    if (mode.kind === "moving") {
      const x = Math.max(0, Math.min(spec.cols - tile.grid_w, hoverCell.col))
      const y = Math.max(0, Math.min(spec.rows - tile.grid_h, hoverCell.row))
      return { x, y, w: tile.grid_w, h: tile.grid_h }
    }
    if (mode.kind === "resizing") {
      const h = mode.handle
      let x = tile.grid_x, y = tile.grid_y, w = tile.grid_w, ht = tile.grid_h
      if (h.includes("e")) w = Math.max(1, Math.min(spec.cols - x, hoverCell.col - x + 1))
      if (h.includes("s")) ht = Math.max(1, Math.min(spec.rows - y, hoverCell.row - y + 1))
      if (h.includes("w")) { const nx = Math.max(0, Math.min(hoverCell.col, tile.grid_x + tile.grid_w - 1)); w = tile.grid_x + tile.grid_w - nx; x = nx }
      if (h.includes("n")) { const ny = Math.max(0, Math.min(hoverCell.row, tile.grid_y + tile.grid_h - 1)); ht = tile.grid_y + tile.grid_h - ny; y = ny }
      return { x, y, w, h: ht }
    }
    return null
  })()

  const ghostExcludeIds = mode.kind === "dragging" ? new Set([mode.tileId])
    : mode.kind === "drag-resize" ? new Set([mode.tileId])
    : mode.kind === "palette-drop" ? new Set<number>()
    : selectedIds

  const ghostValid = ghostRect
    ? isWithinBounds(ghostRect, spec) && !collidesExcluding(ghostRect, tiles, ghostExcludeIds)
    : false

  const snapGuides = computeSnapGuides(ghostRect, tiles, ghostExcludeIds)

  // ---- Data loading ----
  useEffect(() => {
    async function load() {
      try {
        const [lays, nots] = await Promise.all([api.layouts.list(), api.notices.list()])
        setLayouts(lays)
        setNotices(nots)
        if (lays.length > 0) {
          const targetId = layoutParam ? Number(layoutParam) : null
          const lay = (targetId ? lays.find((l) => l.id === targetId) : null) ?? lays[0]
          setActiveLayout(lay)
          const ver = lay.versions[0] ?? null
          setVersion(ver)
          setTiles(ver?.tiles ?? [])
        }
      } catch (e) {
        console.error("Failed to load builder data", e)
        toast("error", "Failed to load builder data")
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Persist helpers ----
  const persistTile = useCallback(
    async (tileId: number, patch: TileUpdate) => {
      if (!activeLayout || !version) return
      const updated = await save.wrap(
        () => api.tiles.update(activeLayout.id, version.id, tileId, patch),
        "Tile update failed",
      )
      if (updated) setTiles((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    },
    [activeLayout, version, save],
  )

  const persistBulk = useCallback(
    async (items: TileBulkUpdateItem[]) => {
      if (!activeLayout || !version || items.length === 0) return
      const updated = await save.wrap(
        () => api.tiles.bulkUpdate(activeLayout.id, version.id, items),
        "Bulk update failed",
      )
      if (updated) {
        setTiles((prev) => {
          const map = new Map(updated.map((t) => [t.id, t]))
          return prev.map((t) => map.get(t.id) ?? t)
        })
      }
    },
    [activeLayout, version, save],
  )

  const updateGridSpec = useCallback(
    async (patch: { grid_cols?: number; grid_rows?: number; gap_px?: number }) => {
      if (!activeLayout || !version) return
      const newSpec: GridSpec = {
        cols:  patch.grid_cols ?? spec.cols,
        rows:  patch.grid_rows ?? spec.rows,
        gapPx: patch.gap_px    ?? spec.gapPx,
      }
      const updated = await save.wrap(
        () => api.versions.update(activeLayout.id, version.id, patch),
        "Grid update failed",
      )
      if (!updated) return
      setVersion(updated)

      // Reflow: if any tile no longer fits the new spec, clamp/repack.
      const needsReflow = updated.tiles.some((t) =>
        !isWithinBounds(tileRect(t), newSpec)
      )
      if (!needsReflow) {
        setTiles(updated.tiles)
        return
      }
      history.push(updated.tiles)
      const clamped = updated.tiles.map((t) => {
        const c = clampRectToSpec(tileRect(t), newSpec)
        return { ...t, grid_x: c.x, grid_y: c.y, grid_w: c.w, grid_h: c.h }
      })
      // Repack any that now overlap.
      const repacked = autoFitRects(clamped.map(tileRect), newSpec)
      const items: TileBulkUpdateItem[] = []
      const next = clamped.map((t, i) => {
        const r = repacked[i]
        if (t.grid_x !== r.x || t.grid_y !== r.y || t.grid_w !== r.w || t.grid_h !== r.h) {
          items.push({ id: t.id, grid_x: r.x, grid_y: r.y, grid_w: r.w, grid_h: r.h })
        }
        return { ...t, grid_x: r.x, grid_y: r.y, grid_w: r.w, grid_h: r.h }
      })
      setTiles(next)
      if (items.length > 0) {
        await save.wrap(
          () => api.tiles.bulkUpdate(activeLayout.id, version.id, items),
          "Reflow persist failed",
        )
        toast("info", `Reflowed ${items.length} tile${items.length > 1 ? "s" : ""} to fit new grid`)
      }
    },
    [activeLayout, version, save, spec, history, toast],
  )

  // ---- Auto-Fit: re-pack every tile into the grid with no overlaps ----
  const autoFitTiles = useCallback(async () => {
    if (!activeLayout || !version || tiles.length === 0) return
    const newRects = autoFitRects(tiles.map(tileRect), spec)
    const items: TileBulkUpdateItem[] = []
    const next = tiles.map((t, i) => {
      const r = newRects[i]
      if (t.grid_x !== r.x || t.grid_y !== r.y || t.grid_w !== r.w || t.grid_h !== r.h) {
        items.push({ id: t.id, grid_x: r.x, grid_y: r.y, grid_w: r.w, grid_h: r.h })
      }
      return { ...t, grid_x: r.x, grid_y: r.y, grid_w: r.w, grid_h: r.h }
    })
    if (items.length === 0) {
      toast("info", "Already perfectly arranged")
      return
    }
    history.push(tiles)
    setTiles(next)
    await save.wrap(
      () => api.tiles.bulkUpdate(activeLayout.id, version.id, items),
      "Auto-fit failed",
    )
    toast("success", `Auto-arranged ${items.length} tile${items.length > 1 ? "s" : ""}`)
  }, [activeLayout, version, tiles, spec, history, save, toast])

  // ---- Tile operations ----
  const addTile = useCallback(
    async (type: string, atX?: number, atY?: number) => {
      if (!activeLayout || !version) return
      const w = type === "ticker" ? Math.min(spec.cols, 12) : type === "banner" ? Math.min(6, spec.cols) : Math.min(2, spec.cols)
      const h = type === "ticker" ? 1 : Math.min(2, spec.rows)
      const pos = (atX !== undefined && atY !== undefined)
        ? { x: Math.max(0, Math.min(spec.cols - w, atX)), y: Math.max(0, Math.min(spec.rows - h, atY)) }
        : findFirstEmpty(tiles, spec, w, h)
      const body: TileCreate = {
        tile_type: type, grid_x: pos.x, grid_y: pos.y,
        grid_w: Math.min(w, spec.cols - pos.x), grid_h: Math.min(h, spec.rows - pos.y),
        z_index: tiles.length,
      }
      history.push(tiles)
      const created = await save.wrap(
        () => api.tiles.create(activeLayout.id, version.id, body),
        "Add tile failed",
      )
      if (created) {
        setTiles((prev) => [...prev, created])
        select(created.id)
        setMode({ kind: "idle" })
        toast("success", `Added ${type} tile`, `#${created.id} at (${created.grid_x}, ${created.grid_y})`)
      }
    },
    [activeLayout, version, tiles, spec, history, save, select, toast],
  )

  const deleteTiles = useCallback(
    async (ids: Set<number>) => {
      if (!activeLayout || !version) return
      const toDelete = [...ids].filter((id) => !lockedIds.has(id))
      if (toDelete.length === 0) {
        toast("warning", "Cannot delete locked tiles")
        return
      }
      history.push(tiles)
      await save.wrap(async () => {
        await Promise.all(toDelete.map((id) => api.tiles.delete(activeLayout.id, version.id, id)))
      }, "Delete failed")
      setTiles((prev) => prev.filter((t) => !toDelete.includes(t.id)))
      clearSelection()
      setMode({ kind: "idle" })
      toast("info", `Deleted ${toDelete.length} tile${toDelete.length > 1 ? "s" : ""}`)
    },
    [activeLayout, version, lockedIds, tiles, history, save, clearSelection, toast],
  )

  const duplicateTiles = useCallback(
    async (ids: Set<number>) => {
      if (!activeLayout || !version) return
      const toDup = tiles.filter((t) => ids.has(t.id))
      if (toDup.length === 0) return
      history.push(tiles)
      const newIds: number[] = []
      await save.wrap(async () => {
        for (const t of toDup) {
          const pos = findFirstEmpty([...tiles], spec, t.grid_w, t.grid_h)
          const body: TileCreate = {
            tile_type: t.tile_type, grid_x: pos.x, grid_y: pos.y,
            grid_w: t.grid_w, grid_h: t.grid_h, z_index: tiles.length + newIds.length,
            notice_id: t.notice_id, config_json: t.config_json,
          }
          const created = await api.tiles.create(activeLayout.id, version.id, body)
          setTiles((prev) => [...prev, created])
          newIds.push(created.id)
        }
      }, "Duplicate failed")
      setSelectedIds(new Set(newIds))
      toast("success", `Duplicated ${toDup.length} tile${toDup.length > 1 ? "s" : ""}`)
    },
    [activeLayout, version, tiles, spec, history, save, setSelectedIds, toast],
  )

  const publishVersion = useCallback(async () => {
    if (!activeLayout || !version) return
    await save.wrap(
      () => api.versions.publish(activeLayout.id, version.id),
      "Publish failed",
    )
    setVersion((v) => (v ? { ...v, is_published: true } : v))
    toast("success", "Version published!", "Now live on display screens")
  }, [activeLayout, version, save, toast])

  const cloneVersion = useCallback(async () => {
    if (!activeLayout || !version) return
    const newVer = await save.wrap(
      () => api.versions.clone(activeLayout.id, version.id),
      "Clone version failed",
    )
    if (newVer) {
      const lays = await api.layouts.list()
      setLayouts(lays)
      const lay = lays.find((l) => l.id === activeLayout.id)
      if (lay) {
        setActiveLayout(lay)
        const ver = lay.versions.find((v) => v.id === newVer.id) ?? lay.versions[0]
        setVersion(ver)
        setTiles(ver.tiles)
      }
      clearSelection()
      toast("success", "Version cloned", `v${newVer.version} created as draft`)
    }
  }, [activeLayout, version, save, clearSelection, toast])

  // ---- Undo / Redo ----
  function undo() {
    const prev = history.undo(tiles)
    if (prev) { setTiles(prev); clearSelection(); setMode({ kind: "idle" }) }
  }
  function redo() {
    const next = history.redo(tiles)
    if (next) { setTiles(next); clearSelection(); setMode({ kind: "idle" }) }
  }

  // ---- Align/distribute ----
  function applyAlignment(fn: (rects: GridRect[], ...args: number[]) => GridRect[], ...args: number[]) {
    if (selectedTiles.length < 2) return
    const rects = selectedTiles.map(tileRect)
    const newRects = fn(rects, ...args)
    if (!newRects.every((r) => isWithinBounds(r, spec))) return
    history.push(tiles)
    const updates: TileBulkUpdateItem[] = []
    const newTiles = tiles.map((t) => {
      const idx = selectedTiles.findIndex((st) => st.id === t.id)
      if (idx < 0) return t
      const nr = newRects[idx]
      updates.push({ id: t.id, grid_x: nr.x, grid_y: nr.y })
      return { ...t, grid_x: nr.x, grid_y: nr.y }
    })
    setTiles(newTiles)
    persistBulk(updates)
  }

  function toggleLock(id: number) {
    setLockedIds((prev) => {
      const next = new Set(prev)
      const wasLocked = next.has(id)
      if (wasLocked) next.delete(id); else next.add(id)
      toast("info", wasLocked ? "Tile unlocked" : "Tile locked")
      return next
    })
  }

  function bringToFront(ids: Set<number>) {
    const maxZ = Math.max(...tiles.map((t) => t.z_index), 0)
    history.push(tiles)
    const updates: TileBulkUpdateItem[] = []
    let z = maxZ + 1
    setTiles((prev) => prev.map((t) => {
      if (!ids.has(t.id)) return t
      updates.push({ id: t.id, z_index: z })
      return { ...t, z_index: z++ }
    }))
    persistBulk(updates)
  }

  function sendToBack(ids: Set<number>) {
    history.push(tiles)
    const updates: TileBulkUpdateItem[] = []
    let z = 0
    setTiles((prev) => prev.map((t) => {
      if (!ids.has(t.id)) return t
      updates.push({ id: t.id, z_index: z })
      return { ...t, z_index: z++ }
    }))
    persistBulk(updates)
  }

  // ---- Real drag-and-drop handlers ----
  function handleTileMouseDown(e: React.MouseEvent, tile: TileRead) {
    if (e.button !== 0 || lockedIds.has(tile.id)) return
    const grid = gridRef.current
    if (!grid) return

    const cell = pixelToCell(e.clientX, e.clientY, grid, spec, 8)
    const offsetCol = cell.col - tile.grid_x
    const offsetRow = cell.row - tile.grid_y

    // Select on mousedown
    if (!e.shiftKey && !selectedIds.has(tile.id)) select(tile.id)

    dragStartCell.current = cell
    hasDragged.current = false
    setMode({ kind: "dragging", tileId: tile.id, offsetCol, offsetRow })
    setHoverCell(cell)
  }

  function handleResizeMouseDown(e: React.MouseEvent, tile: TileRead, handle: string) {
    if (e.button !== 0 || lockedIds.has(tile.id)) return
    e.preventDefault()
    const grid = gridRef.current
    if (!grid) return
    const cell = pixelToCell(e.clientX, e.clientY, grid, spec, 8)
    select(tile.id)
    dragStartCell.current = cell
    hasDragged.current = false
    setMode({ kind: "drag-resize", tileId: tile.id, handle })
    setHoverCell(cell)
  }

  function handleGridMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (mode.kind === "palette-drop") return // let mouseUp handle it
    // Clicking on empty space should deselect (handled in mouseUp if no drag)
    const grid = gridRef.current
    if (!grid) return
    dragStartCell.current = pixelToCell(e.clientX, e.clientY, grid, spec, 8)
    hasDragged.current = false
  }

  function handleGridMouseMove(e: React.MouseEvent) {
    const grid = gridRef.current
    if (!grid) return
    const cell = pixelToCell(e.clientX, e.clientY, grid, spec, 8)

    // Check if we've dragged at least 1 cell
    if (dragStartCell.current && (cell.col !== dragStartCell.current.col || cell.row !== dragStartCell.current.row)) {
      hasDragged.current = true
    }

    if (mode.kind !== "idle") {
      setHoverCell(cell)
    }
  }

  function handleGridMouseUp(e: React.MouseEvent) {
    const grid = gridRef.current
    if (!grid) return
    const cell = pixelToCell(e.clientX, e.clientY, grid, spec, 8)

    // Handle palette drop
    if (mode.kind === "palette-drop" && ghostRect && ghostValid) {
      addTile(mode.tileType, ghostRect.x, ghostRect.y)
      setMode({ kind: "idle" })
      setHoverCell(null)
      dragStartCell.current = null
      return
    }

    // Handle drag completion
    if (mode.kind === "dragging" && hasDragged.current && ghostRect && ghostValid) {
      const tile = tiles.find((t) => t.id === mode.tileId)
      if (tile) {
        history.push(tiles)
        setTiles((prev) => prev.map((t) =>
          t.id === tile.id ? { ...t, grid_x: ghostRect.x, grid_y: ghostRect.y } : t
        ))
        persistTile(tile.id, { grid_x: ghostRect.x, grid_y: ghostRect.y })
      }
      setMode({ kind: "idle" })
      setHoverCell(null)
      dragStartCell.current = null
      return
    }

    // Handle drag-resize completion
    if (mode.kind === "drag-resize" && hasDragged.current && ghostRect && ghostValid) {
      const tile = tiles.find((t) => t.id === mode.tileId)
      if (tile) {
        history.push(tiles)
        setTiles((prev) => prev.map((t) =>
          t.id === tile.id ? { ...t, grid_x: ghostRect.x, grid_y: ghostRect.y, grid_w: ghostRect.w, grid_h: ghostRect.h } : t
        ))
        persistTile(tile.id, { grid_x: ghostRect.x, grid_y: ghostRect.y, grid_w: ghostRect.w, grid_h: ghostRect.h })
      }
      setMode({ kind: "idle" })
      setHoverCell(null)
      dragStartCell.current = null
      return
    }

    // Handle legacy click-to-move/resize
    if (mode.kind === "moving" && singleSelected && !lockedIds.has(singleSelected.id)) {
      const newX = Math.max(0, Math.min(spec.cols - singleSelected.grid_w, cell.col))
      const newY = Math.max(0, Math.min(spec.rows - singleSelected.grid_h, cell.row))
      const candidate: GridRect = { x: newX, y: newY, w: singleSelected.grid_w, h: singleSelected.grid_h }
      if (isWithinBounds(candidate, spec) && !collidesExcluding(candidate, tiles, selectedIds)) {
        history.push(tiles)
        setTiles((prev) => prev.map((t) => (t.id === singleSelected.id ? { ...t, grid_x: newX, grid_y: newY } : t)))
        persistTile(singleSelected.id, { grid_x: newX, grid_y: newY })
      }
      setMode({ kind: "idle" })
      dragStartCell.current = null
      return
    }

    if (mode.kind === "resizing" && singleSelected && ghostRect && ghostValid && !lockedIds.has(singleSelected.id)) {
      history.push(tiles)
      setTiles((prev) => prev.map((t) =>
        t.id === singleSelected.id
          ? { ...t, grid_x: ghostRect.x, grid_y: ghostRect.y, grid_w: ghostRect.w, grid_h: ghostRect.h }
          : t,
      ))
      persistTile(singleSelected.id, { grid_x: ghostRect.x, grid_y: ghostRect.y, grid_w: ghostRect.w, grid_h: ghostRect.h })
      setMode({ kind: "idle" })
      dragStartCell.current = null
      return
    }

    // If no drag happened, treat as a click on empty space to deselect
    if (mode.kind === "dragging" && !hasDragged.current) {
      // Was just a click on a tile — keep selection
      setMode({ kind: "idle" })
    } else if (mode.kind === "idle" || (mode.kind === "dragging" && !hasDragged.current)) {
      const clickedTile = tileAtCell(cell.col, cell.row, tiles)
      if (!clickedTile) { clearSelection(); setMode({ kind: "idle" }) }
    } else {
      setMode({ kind: "idle" })
    }

    setHoverCell(null)
    dragStartCell.current = null
  }

  function handleTileClick(e: React.MouseEvent, tile: TileRead) {
    // Only handle shift-click for multi-select (normal clicks handled by drag system)
    if (e.shiftKey) { toggle(tile.id); return }
    // Single click: just select (drag handler already did this on mousedown)
    if (!selectedIds.has(tile.id)) select(tile.id)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMode({ kind: "idle" })
    const grid = gridRef.current
    if (!grid) return
    const cell = pixelToCell(e.clientX, e.clientY, grid, spec, 8)
    const tile = tileAtCell(cell.col, cell.row, tiles)
    if (tile && !selectedIds.has(tile.id)) select(tile.id)
    setCtxMenu({ x: e.clientX, y: e.clientY, tileId: tile?.id ?? null, cell })
  }

  function getContextMenuItems(): ContextMenuItem[] {
    if (ctxMenu?.tileId != null) {
      const tId = ctxMenu.tileId
      const isLocked = lockedIds.has(tId)
      return [
        { label: "Duplicate", icon: "📋", shortcut: "Ctrl+D", onClick: () => duplicateTiles(selectedIds) },
        { label: isLocked ? "Unlock" : "Lock", icon: isLocked ? "🔓" : "🔒", shortcut: "Ctrl+L", onClick: () => toggleLock(tId) },
        { label: "", separator: true, onClick: () => {} },
        { label: "Bring to Front", icon: "⬆️", onClick: () => bringToFront(selectedIds) },
        { label: "Send to Back", icon: "⬇️", onClick: () => sendToBack(selectedIds) },
        { label: "", separator: true, onClick: () => {} },
        { label: "Delete", icon: "🗑️", shortcut: "Del", danger: true, onClick: () => deleteTiles(selectedIds), disabled: isLocked },
      ]
    }
    return TILE_TYPES.map((tt) => ({ label: `Add ${tt.label}`, icon: tt.icon, onClick: () => addTile(tt.value, ctxMenu?.cell.col, ctxMenu?.cell.row) }))
  }

  // ---- Inspector field update ----
  function updateField(field: keyof TileUpdate, value: number | string | boolean | null) {
    if (!singleSelected || lockedIds.has(singleSelected.id)) return
    const updated = { ...singleSelected, [field]: value }
    const rect: GridRect = { x: updated.grid_x, y: updated.grid_y, w: updated.grid_w, h: updated.grid_h }
    if (["grid_x", "grid_y", "grid_w", "grid_h"].includes(field)) {
      if (!isWithinBounds(rect, spec) || collidesExcluding(rect, tiles, selectedIds)) return
    }
    history.push(tiles)
    setTiles((prev) => prev.map((t) => (t.id === singleSelected.id ? { ...t, [field]: value } : t)))
    persistTile(singleSelected.id, { [field]: value })
  }

  // ---- Bulk update for multi-inspector ----
  function bulkUpdateField(field: keyof TileUpdate, value: number | string | boolean | null) {
    if (selectedTiles.length < 2 || !activeLayout || !version) return
    history.push(tiles)
    const updates: TileBulkUpdateItem[] = []
    setTiles((prev) => prev.map((t) => {
      if (!selectedIds.has(t.id) || lockedIds.has(t.id)) return t
      updates.push({ id: t.id, [field]: value })
      return { ...t, [field]: value }
    }))
    persistBulk(updates)
    toast("info", `Updated ${field} on ${updates.length} tiles`)
  }

  // ---- Palette drag start ----
  function handlePaletteDragStart(type: string, w: number, h: number) {
    setMode({ kind: "palette-drop", tileType: type, w: Math.min(w, spec.cols), h: Math.min(h, spec.rows) })
  }

  // ---- Keyboard ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName
      const inInput = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA"
      if (e.key === "Escape") { setMode({ kind: "idle" }); setCtxMenu(null); setHoverCell(null); return }
      if ((e.ctrlKey || e.metaKey) && !inInput) {
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); return }
        if (e.key === "d") { e.preventDefault(); if (selectedIds.size > 0) duplicateTiles(selectedIds); return }
        if (e.key === "l") { e.preventDefault(); if (singleSelected) toggleLock(singleSelected.id); return }
        if (e.key === "a") { e.preventDefault(); selectAll(tiles.map((t) => t.id)); return }
      }
      if (inInput) return
      if (e.key === "g") { setShowGrid((v) => !v); return }
      if (selectedIds.size === 0) return
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteTiles(selectedIds) }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
        const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0
        const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0
        const movable = selectedTiles.filter((t) => !lockedIds.has(t.id))
        const allValid = movable.every((t) => {
          const candidate: GridRect = { x: t.grid_x + dx, y: t.grid_y + dy, w: t.grid_w, h: t.grid_h }
          return isWithinBounds(candidate, spec) && !collidesExcluding(candidate, tiles, selectedIds)
        })
        if (allValid && movable.length > 0) {
          history.push(tiles)
          const updates: TileBulkUpdateItem[] = []
          setTiles((prev) => prev.map((t) => {
            if (!selectedIds.has(t.id) || lockedIds.has(t.id)) return t
            updates.push({ id: t.id, grid_x: t.grid_x + dx, grid_y: t.grid_y + dy })
            return { ...t, grid_x: t.grid_x + dx, grid_y: t.grid_y + dy }
          }))
          persistBulk(updates)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, selectedTiles, singleSelected, tiles, spec, lockedIds])

  // ---- Layout management ----
  async function createFirstLayout() {
    const lay = await save.wrap(
      () => api.layouts.create({ name: "Main Board", grid_cols: 12, grid_rows: 8, gap_px: 8 }),
      "Create layout failed",
    )
    if (lay) {
      setLayouts([lay]); setActiveLayout(lay)
      const ver = lay.versions[0] ?? null
      setVersion(ver); setTiles(ver?.tiles ?? [])
      toast("success", "Layout created!")
    }
  }

  function switchLayout(layoutId: number) {
    const lay = layouts.find((l) => l.id === layoutId)
    if (!lay) return
    setActiveLayout(lay)
    const ver = lay.versions[0] ?? null
    setVersion(ver); setTiles(ver?.tiles ?? [])
    clearSelection(); setMode({ kind: "idle" }); history.reset()
  }

  function switchVersion(versionId: number) {
    if (!activeLayout) return
    const ver = activeLayout.versions.find((v) => v.id === versionId)
    if (!ver) return
    setVersion(ver); setTiles(ver.tiles)
    clearSelection(); setMode({ kind: "idle" }); history.reset()
  }

  // ---- Status ----
  const modeLabel =
    mode.kind === "dragging" ? "Dragging tile — release to place"
    : mode.kind === "drag-resize" ? "Resizing tile — release to apply"
    : mode.kind === "palette-drop" ? `Click on the canvas to place ${mode.tileType} tile`
    : mode.kind === "moving" ? "Click a cell to move the tile"
    : mode.kind === "resizing" ? "Click a cell to resize"
    : selectedIds.size > 1 ? `${selectedIds.size} tiles selected — Shift+click to toggle`
    : singleSelected ? "Drag to move · Drag handles to resize"
    : "Click a tile to select · Right-click for options"

  // ---- Render ----
  if (loading)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
        <p className="text-sm text-zinc-500">Loading builder&hellip;</p>
      </div>
    )

  if (!activeLayout || !version)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-zinc-950">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 text-center max-w-md">
          <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">Welcome to the Layout Builder</h2>
          <p className="mt-2 text-sm text-zinc-500">Create your first layout to start designing your notice board display.</p>
          <button onClick={createFirstLayout} className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all">
            Create Your First Layout
          </button>
        </div>
      </div>
    )

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <BuilderToolbar
        layouts={layouts} activeLayout={activeLayout} version={version}
        saving={save.saving} lastSaved={save.lastSaved} saveError={save.saveError}
        canUndo={history.canUndo} canRedo={history.canRedo}
        showGrid={showGrid} showGridSettings={showGridSettings}
        onSwitchLayout={switchLayout} onSwitchVersion={switchVersion}
        onUndo={undo} onRedo={redo}
        onToggleGrid={() => setShowGrid((v) => !v)}
        onToggleSettings={() => setShowGridSettings((v) => !v)}
        onCloneVersion={cloneVersion} onPublish={publishVersion}
      />

      {showGridSettings && <GridSettingsPanel spec={spec} tileCount={tiles.length} onUpdate={updateGridSpec} onAutoFit={autoFitTiles} />}

      <AlignToolbar count={selectedIds.size}
        onAlignLeft={() => applyAlignment(alignLeft)}
        onAlignRight={() => applyAlignment(alignRight, spec.cols)}
        onAlignTop={() => applyAlignment(alignTop)}
        onAlignBottom={() => applyAlignment(alignBottom, spec.rows)}
        onDistributeH={() => applyAlignment(distributeH)}
        onDistributeV={() => applyAlignment(distributeV)}
      />

      {/* Status bar */}
      <div className={`flex items-center gap-3 border-b px-4 py-1 text-xs ${
        mode.kind !== "idle" ? "border-blue-500/30 bg-blue-950/30 text-blue-400" : "border-zinc-800/50 bg-zinc-900/30 text-zinc-500"
      }`}>
        {mode.kind !== "idle" && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            {mode.kind === "dragging" ? "DRAG" : mode.kind === "drag-resize" ? "RESIZE" : mode.kind === "palette-drop" ? "PLACE" : mode.kind === "moving" ? "MOVE" : "RESIZE"}
          </span>
        )}
        <span>{modeLabel}</span>
        {mode.kind !== "idle" && (
          <button onClick={() => { setMode({ kind: "idle" }); setHoverCell(null) }} className="rounded-md bg-zinc-800 px-2.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-700 border border-zinc-700">
            Cancel (Esc)
          </button>
        )}
        <span className="ml-auto text-[10px] text-zinc-700">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${tiles.length} tiles`}
          {hoverCell && ` · (${hoverCell.col}, ${hoverCell.row})`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <TilePalette disabled={save.saving} onAddTile={addTile} onStartDrag={handlePaletteDragStart} />

        <BuilderCanvas ref={gridRef}
          tiles={tiles} notices={notices} spec={spec}
          selectedIds={selectedIds} lockedIds={lockedIds} mode={mode}
          showGrid={showGrid} ghostRect={ghostRect} ghostValid={ghostValid}
          snapGuides={snapGuides}
          zoom={zoom} onZoomChange={setZoom}
          onTileMouseDown={handleTileMouseDown}
          onResizeMouseDown={handleResizeMouseDown}
          onGridMouseDown={handleGridMouseDown}
          onGridMouseMove={handleGridMouseMove}
          onGridMouseUp={handleGridMouseUp}
          onGridMouseLeave={() => { if (mode.kind === "idle") setHoverCell(null) }}
          onContextMenu={handleContextMenu}
          onTileClick={handleTileClick}
        />

        {/* Right inspector */}
        <aside className="flex w-64 flex-shrink-0 flex-col border-l border-zinc-800 overflow-y-auto">
          {singleSelected ? (
            <div className="p-3">
              <TileInspector
                tile={singleSelected} notices={notices} spec={spec}
                isLocked={lockedIds.has(singleSelected.id)}
                onUpdate={updateField}
                onDelete={() => deleteTiles(selectedIds)}
                onMove={() => { if (!lockedIds.has(singleSelected.id)) setMode({ kind: "moving" }) }}
                onDuplicate={() => duplicateTiles(selectedIds)}
                onToggleLock={() => toggleLock(singleSelected.id)}
                onCreateNotice={async (title, body) => {
                  try {
                    const notice = await api.notices.create({ title, body, summary: title, priority: 50 })
                    setNotices((prev) => [...prev, notice])
                    updateField("notice_id", notice.id)
                    toast("success", "Notice created", `"${title}" assigned to tile`)
                  } catch (e) { console.error("Create notice failed", e); toast("error", "Failed to create notice") }
                }}
              />
            </div>
          ) : selectedIds.size > 1 ? (
            <div className="p-3">
              <MultiInspector count={selectedIds.size}
                selectedTiles={selectedTiles}
                onDelete={() => deleteTiles(selectedIds)}
                onDuplicate={() => duplicateTiles(selectedIds)}
                onBringToFront={() => bringToFront(selectedIds)}
                onSendToBack={() => sendToBack(selectedIds)}
                onBulkUpdate={bulkUpdateField}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="rounded-xl bg-zinc-800/30 p-4 border border-dashed border-zinc-800">
                <svg className="h-8 w-8 text-zinc-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-sm text-zinc-500 font-medium">No tile selected</p>
                <p className="text-[11px] text-zinc-600 mt-1">Click a tile to inspect and edit its properties</p>
              </div>
              <div className="space-y-1.5 text-[10px] text-zinc-700">
                <p>Drag tiles to move them</p>
                <p>Drag handles to resize</p>
                <p>Drag from palette to place</p>
                <p>Right-click for context menu</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getContextMenuItems()} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exported wrapper with ToastProvider
// ---------------------------------------------------------------------------

export function LayoutBuilder() {
  return (
    <ToastProvider>
      <LayoutBuilderInner />
    </ToastProvider>
  )
}
