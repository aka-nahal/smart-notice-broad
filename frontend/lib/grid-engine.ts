/**
 * Grid layout engine: cell coordinates (x,y) origin top-left, spans (w,h) in columns/rows.
 * Maps to CSS Grid placement: gridRow / gridColumn as start / end lines (1-based).
 */

export interface GridRect {
  x: number
  y: number
  w: number
  h: number
}

export interface GridSpec {
  cols: number
  rows: number
  gapPx: number
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  if (a.x + a.w <= b.x || b.x + b.w <= a.x) return false
  if (a.y + a.h <= b.y || b.y + b.h <= a.y) return false
  return true
}

export function isWithinBounds(rect: GridRect, spec: GridSpec): boolean {
  if (rect.x < 0 || rect.y < 0) return false
  if (rect.w < 1 || rect.h < 1) return false
  if (rect.x + rect.w > spec.cols) return false
  if (rect.y + rect.h > spec.rows) return false
  return true
}

export function collidesWithAny(rect: GridRect, others: GridRect[], excludeIndex?: number): boolean {
  return others.some((o, i) => i !== excludeIndex && rectsOverlap(rect, o))
}

/** Snap pixel delta to nearest cell given container inner size (excluding padding). */
export function snapPixelsToCells(params: {
  deltaXPx: number
  deltaYPx: number
  cellWidthPx: number
  cellHeightPx: number
}): { dx: number; dy: number } {
  const { deltaXPx, deltaYPx, cellWidthPx, cellHeightPx } = params
  if (cellWidthPx <= 0 || cellHeightPx <= 0) return { dx: 0, dy: 0 }
  return {
    dx: Math.round(deltaXPx / cellWidthPx),
    dy: Math.round(deltaYPx / cellHeightPx)
  }
}

/** CSS grid line indices (1-based): rowStart / colStart / rowEnd / colEnd */
export function rectToGridPlacement(rect: GridRect): {
  gridRow: string
  gridColumn: string
} {
  const rowStart = rect.y + 1
  const colStart = rect.x + 1
  const rowEnd = rect.y + rect.h + 1
  const colEnd = rect.x + rect.w + 1
  return {
    gridRow: `${rowStart} / ${rowEnd}`,
    gridColumn: `${colStart} / ${colEnd}`
  }
}

export function sortByPaintOrder<T extends { zIndex: number; id: number }>(tiles: T[]): T[] {
  return [...tiles].sort((a, b) => a.zIndex - b.zIndex || a.id - b.id)
}
