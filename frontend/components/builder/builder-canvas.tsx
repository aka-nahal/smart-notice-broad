"use client"

import { forwardRef, useCallback, useMemo } from "react"
import type { TileRead, NoticeRead, InteractionMode } from "@/lib/types"
import { TILE_COLORS, TILE_COLORS_SELECTED } from "@/lib/types"
import type { GridRect, GridSpec } from "@/lib/grid-engine"
import { TilePreview } from "./tile-preview"

function tileColor(type: string, selected: boolean) {
  const map = selected ? TILE_COLORS_SELECTED : TILE_COLORS
  return map[type] ?? (selected ? "border-zinc-400 bg-zinc-500/20 ring-1 ring-zinc-400/50" : "border-zinc-400/50 dark:border-zinc-600/50 bg-zinc-200/10 dark:bg-zinc-700/10")
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200] as const

interface Props {
  tiles: TileRead[]
  notices: NoticeRead[]
  spec: GridSpec
  selectedIds: Set<number>
  lockedIds: Set<number>
  mode: InteractionMode
  showGrid: boolean
  ghostRect: GridRect | null
  ghostValid: boolean
  snapGuides: { type: "row" | "col"; pos: number }[]
  zoom: number
  onZoomChange: (z: number) => void
  onTileMouseDown: (e: React.MouseEvent, tile: TileRead) => void
  onResizeMouseDown: (e: React.MouseEvent, tile: TileRead, handle: string) => void
  onGridMouseDown: (e: React.MouseEvent) => void
  onGridMouseMove: (e: React.MouseEvent) => void
  onGridMouseUp: (e: React.MouseEvent) => void
  onGridMouseLeave: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onTileClick: (e: React.MouseEvent, tile: TileRead) => void
}

export const BuilderCanvas = forwardRef<HTMLDivElement, Props>(function BuilderCanvas(
  { tiles, notices, spec, selectedIds, lockedIds, mode, showGrid, ghostRect, ghostValid,
    snapGuides, zoom, onZoomChange,
    onTileMouseDown, onResizeMouseDown, onGridMouseDown, onGridMouseMove, onGridMouseUp, onGridMouseLeave,
    onContextMenu, onTileClick },
  ref
) {
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const idx = ZOOM_LEVELS.findIndex((z) => z >= zoom) ?? ZOOM_LEVELS.length - 1
      if (e.deltaY < 0 && idx < ZOOM_LEVELS.length - 1) onZoomChange(ZOOM_LEVELS[idx + 1])
      else if (e.deltaY > 0 && idx > 0) onZoomChange(ZOOM_LEVELS[idx - 1])
    }
  }, [zoom, onZoomChange])

  const utilization = spec.cols > 0 && spec.rows > 0
    ? Math.round((tiles.reduce((s, t) => s + t.grid_w * t.grid_h, 0) / (spec.cols * spec.rows)) * 100)
    : 0

  const isDragging = mode.kind === "dragging" || mode.kind === "drag-resize" || mode.kind === "palette-drop"
  const isActive = mode.kind !== "idle"

  // Memoize the grid bg cells for performance
  const gridCells = useMemo(() => {
    if (!showGrid) return null
    return Array.from({ length: spec.cols * spec.rows }, (_, i) => {
      const col = i % spec.cols
      const row = Math.floor(i / spec.cols)
      return (
        <div key={`bg-${i}`} className="rounded border border-dashed border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-center">
          {zoom >= 125 && (
            <span className="text-[6px] text-zinc-800/30 tabular-nums select-none">{col},{row}</span>
          )}
        </div>
      )
    })
  }, [showGrid, spec.cols, spec.rows, zoom])

  return (
    <main className="relative flex-1 flex flex-col overflow-hidden">
      {/* Canvas area */}
      <div className="flex-1 overflow-auto p-4" onWheel={handleWheel}>
        <div
          ref={ref}
          className={`relative mx-auto rounded-lg border bg-white dark:bg-zinc-900 p-2 transition-colors ${
            isActive ? "border-blue-500/30 shadow-lg shadow-blue-500/5" : "border-zinc-200 dark:border-zinc-800"
          } ${isDragging ? "cursor-grabbing" : ""}`}
          style={{
            width: `${(spec.cols * 60 + (spec.cols - 1) * spec.gapPx + 16) * (zoom / 100)}px`,
            height: `${(spec.rows * 60 + (spec.rows - 1) * spec.gapPx + 16) * (zoom / 100)}px`,
            minWidth: "400px",
            minHeight: "300px",
            cursor: isDragging ? "grabbing" : isActive ? "crosshair" : "default",
          }}
          onMouseDown={onGridMouseDown}
          onMouseMove={onGridMouseMove}
          onMouseUp={onGridMouseUp}
          onMouseLeave={onGridMouseLeave}
          onContextMenu={onContextMenu}
        >
          {/* Background grid */}
          {showGrid && (
            <div className="absolute inset-2 grid pointer-events-none"
              style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`, gap: spec.gapPx }}>
              {gridCells}
            </div>
          )}

          {/* Snap alignment guides */}
          {snapGuides.map((guide, i) => (
            guide.type === "col" ? (
              <div key={`snap-${i}`} className="absolute top-2 bottom-2 w-px bg-cyan-400/40 pointer-events-none z-[90]"
                style={{ left: `calc(${8 + (guide.pos / spec.cols) * 100}% * (1 - 16px / 100%))` }} />
            ) : (
              <div key={`snap-${i}`} className="absolute left-2 right-2 h-px bg-cyan-400/40 pointer-events-none z-[90]"
                style={{ top: `calc(${8 + (guide.pos / spec.rows) * 100}% * (1 - 16px / 100%))` }} />
            )
          ))}

          {/* Tiles layer */}
          <div className="absolute inset-2 grid"
            style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${spec.rows}, minmax(0, 1fr))`, gap: spec.gapPx }}>
            {tiles.map((tile) => {
              const isSelected = selectedIds.has(tile.id)
              const isBeingDragged = (mode.kind === "dragging" && mode.tileId === tile.id) ||
                                     (mode.kind === "drag-resize" && mode.tileId === tile.id)
              const isBeingMoved = mode.kind === "moving" && isSelected
              const isLocked = lockedIds.has(tile.id)
              const colorCls = tileColor(tile.tile_type, isSelected)
              const notice = tile.notice_id ? notices.find((n) => n.id === tile.notice_id) ?? null : null
              return (
                <div key={tile.id}
                  className={`group relative select-none overflow-hidden rounded-lg border-2 ${colorCls} ${
                    isSelected ? "shadow-xl shadow-blue-500/10 ring-2 ring-blue-400/30 dark:ring-blue-400/40" : "shadow-md hover:shadow-lg"
                  } ${isBeingDragged || isBeingMoved ? "opacity-25 scale-[0.95]" : "opacity-100 hover:scale-[1.005]"} ${
                    !isLocked && mode.kind === "idle" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                  } ${isDragging ? "pointer-events-none" : ""}`}
                  style={{
                    gridRow: `${tile.grid_y + 1} / ${tile.grid_y + tile.grid_h + 1}`,
                    gridColumn: `${tile.grid_x + 1} / ${tile.grid_x + tile.grid_w + 1}`,
                    zIndex: tile.z_index + 10,
                    transition: "opacity 80ms ease-out, transform 120ms ease-out, box-shadow 200ms ease-out, border-color 150ms ease-out",
                  }}
                  onMouseDown={(e) => {
                    if (isDragging) return
                    e.stopPropagation()
                    onTileMouseDown(e, tile)
                  }}
                  onClick={(e) => { e.stopPropagation(); onTileClick(e, tile) }}
                  onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e) }}
                >
                  {isLocked && (
                    <div className="absolute right-1 top-1 z-20 rounded bg-zinc-100/80 dark:bg-zinc-800/80 px-1 py-0.5 text-[8px] text-zinc-500">🔒</div>
                  )}

                  <div className="absolute left-1 top-1 z-20 rounded bg-white/80 dark:bg-zinc-900/80 px-1 py-0.5 text-[7px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    #{tile.id}
                  </div>

                  <TilePreview tile={tile} notice={notice} isSelected={isSelected} isLocked={isLocked}
                    singleSelect={selectedIds.size === 1} idleMode={mode.kind === "idle"} />

                  {/* Resize handles */}
                  {isSelected && mode.kind === "idle" && !isLocked && selectedIds.size === 1 && (
                    <>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-2.5 cursor-e-resize rounded-l bg-blue-400/30 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "e") }} />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2.5 w-8 cursor-s-resize rounded-t bg-blue-400/30 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "s") }} />
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-2.5 cursor-w-resize rounded-r bg-blue-400/30 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "w") }} />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-2.5 w-8 cursor-n-resize rounded-b bg-blue-400/30 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "n") }} />
                      <div className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl bg-blue-400/40 hover:bg-blue-400/90 transition-all"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "se") }} />
                      <div className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize rounded-tr bg-blue-400/20 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "sw") }} />
                      <div className="absolute top-0 right-0 h-3 w-3 cursor-ne-resize rounded-bl bg-blue-400/20 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "ne") }} />
                      <div className="absolute top-0 left-0 h-3 w-3 cursor-nw-resize rounded-br bg-blue-400/20 hover:bg-blue-400/80 transition-all opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, tile, "nw") }} />
                    </>
                  )}

                  {isSelected && (mode.kind === "resizing" || mode.kind === "drag-resize") && (
                    <div className="absolute inset-0 border-2 border-dashed border-blue-400/40 rounded-lg pointer-events-none" />
                  )}
                </div>
              )
            })}

            {/* Ghost preview — stronger fill, animated edges, snappy feedback */}
            {ghostRect && isActive && (
              <div className={`pointer-events-none rounded-lg border-2 ${
                ghostValid
                  ? "border-blue-500 bg-blue-500/20 shadow-[0_0_0_4px_rgba(59,130,246,0.12),0_8px_24px_-4px_rgba(59,130,246,0.35)]"
                  : "border-red-500 bg-red-500/20 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
              }`} style={{
                gridRow: `${ghostRect.y + 1} / ${ghostRect.y + ghostRect.h + 1}`,
                gridColumn: `${ghostRect.x + 1} / ${ghostRect.x + ghostRect.w + 1}`,
                zIndex: 100,
                transition: "background-color 80ms ease-out, border-color 80ms ease-out, box-shadow 120ms ease-out",
              }}>
                {/* corner marks for a designer-tool feel */}
                {ghostValid && (
                  <>
                    <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
                    <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
                    <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
                    <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
                  </>
                )}
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-md bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-2 py-1 text-center shadow">
                    <span className={`block text-[11px] font-semibold tabular-nums ${ghostValid ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"}`}>
                      {ghostRect.w}&times;{ghostRect.h}
                    </span>
                    <span className={`block text-[9px] tabular-nums ${ghostValid ? "text-blue-500/70" : "text-red-500/70"}`}>
                      {ghostValid ? `(${ghostRect.x}, ${ghostRect.y})` : "blocked"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button onClick={() => { const idx = ZOOM_LEVELS.findIndex((z) => z >= zoom); if (idx > 0) onZoomChange(ZOOM_LEVELS[idx - 1]) }}
            disabled={zoom <= ZOOM_LEVELS[0]}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" title="Zoom out (Ctrl+Scroll)">−</button>
          <select value={zoom} onChange={(e) => onZoomChange(Number(e.target.value))}
            className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300 outline-none border border-zinc-300 dark:border-zinc-700">
            {ZOOM_LEVELS.map((z) => <option key={z} value={z}>{z}%</option>)}
          </select>
          <button onClick={() => { const idx = ZOOM_LEVELS.findIndex((z) => z >= zoom); if (idx < ZOOM_LEVELS.length - 1) onZoomChange(ZOOM_LEVELS[idx + 1]) }}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" title="Zoom in (Ctrl+Scroll)">+</button>
          <button onClick={() => onZoomChange(100)}
            className="ml-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300">100%</button>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="tabular-nums">{spec.cols}×{spec.rows}</span>
          <span>·</span>
          <span>{tiles.length} tile{tiles.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span className={utilization > 80 ? "text-amber-500" : ""}>{utilization}%</span>
        </div>

        <div className="relative h-7 w-12 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden" title="Minimap">
          {tiles.map((t) => (
            <div key={t.id} className={`absolute rounded-[1px] transition-colors ${
              selectedIds.has(t.id) ? "bg-blue-400/60" : "bg-zinc-500/30"
            }`} style={{
              left: `${(t.grid_x / spec.cols) * 100}%`,
              top: `${(t.grid_y / spec.rows) * 100}%`,
              width: `${(t.grid_w / spec.cols) * 100}%`,
              height: `${(t.grid_h / spec.rows) * 100}%`,
            }} />
          ))}
        </div>
      </div>
    </main>
  )
})
