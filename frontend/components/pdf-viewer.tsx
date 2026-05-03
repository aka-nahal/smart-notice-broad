"use client"

import { useEffect, useRef, useState } from "react"

export type PdfFit = "page" | "width" | "height"
export type PdfLoop = "forward" | "pingpong"

interface Props {
  url: string
  /** Auto-advance pages every N seconds (0 disables). */
  autoAdvanceSec?: number
  /** Initial page (1-based). */
  page?: number
  /** Total pages — required for wrap and ping-pong. If unknown, auto-advance is off. */
  totalPages?: number
  /** Show overlay chrome (page counter + arrows). */
  showChrome?: boolean
  /** Fit mode passed to the PDF object viewer. */
  fit?: PdfFit
  /** "forward" loops 1→N→1; "pingpong" goes 1→N→1 (back-and-forth). */
  loop?: PdfLoop
}

/**
 * PDF viewer using the browser's built-in PDF renderer via `<object>`.
 * Auto-advances pages with a soft cross-fade and supports two loop modes:
 *   - forward: 1 → 2 → 3 → … → N → 1 → 2 …  (default)
 *   - pingpong: 1 → 2 → 3 → … → N → N-1 → … → 1 → 2 …
 */
export function PdfViewer({
  url,
  autoAdvanceSec = 0,
  page = 1,
  totalPages,
  showChrome = true,
  fit = "page",
  loop = "forward",
}: Props) {
  const [current, setCurrent] = useState(Math.max(1, page))
  const [fading, setFading] = useState(false)
  // For pingpong we need to remember the direction across renders.
  const dirRef = useRef<1 | -1>(1)

  // Auto-advance pages only if total is known.
  useEffect(() => {
    if (!autoAdvanceSec || autoAdvanceSec <= 0) return
    if (!totalPages || totalPages <= 1) return
    const id = setInterval(() => {
      // Brief fade-out, swap page, fade back in. The <object> reload is
      // instantaneous in modern Chrome/Edge; the fade hides any flicker.
      setFading(true)
      setTimeout(() => {
        setCurrent((p) => nextPage(p, totalPages, loop, dirRef))
        // give the new src a tick to mount, then fade in
        requestAnimationFrame(() => setFading(false))
      }, 220)
    }, autoAdvanceSec * 1000)
    return () => clearInterval(id)
  }, [autoAdvanceSec, totalPages, loop])

  const view = fit === "width" ? "FitH" : fit === "height" ? "FitV" : "Fit"
  const src = `${url}#page=${current}&view=${view}&toolbar=0&navpanes=0&statusbar=0`

  function step(delta: 1 | -1) {
    dirRef.current = delta
    setCurrent((p) => {
      if (!totalPages) return Math.max(1, p + delta)
      // Manual nav uses simple wrap regardless of loop mode.
      const n = ((p - 1 + delta + totalPages) % totalPages) + 1
      return n
    })
  }

  return (
    <div className="relative h-full w-full bg-zinc-100 dark:bg-zinc-900">
      <object
        key={src}
        data={src}
        type="application/pdf"
        className={`h-full w-full transition-opacity duration-200 ease-out ${fading ? "opacity-0" : "opacity-100"}`}
      >
        {/* Fallback for browsers that won't embed PDFs */}
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center p-4">
          <span className="text-3xl">📄</span>
          <p className="text-sm text-zinc-500">Inline PDF preview not supported</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-500">
            Open document &nearr;
          </a>
        </div>
      </object>

      {showChrome && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm pointer-events-auto">
          <button onClick={() => step(-1)} className="rounded-full px-1 hover:bg-white/10" title="Previous page">‹</button>
          <span className="tabular-nums">{current}{totalPages ? ` / ${totalPages}` : ""}</span>
          <button onClick={() => step(1)} className="rounded-full px-1 hover:bg-white/10" title="Next page">›</button>
        </div>
      )}
    </div>
  )
}

function nextPage(p: number, total: number, loop: PdfLoop, dirRef: React.MutableRefObject<1 | -1>): number {
  if (loop === "pingpong") {
    if (dirRef.current === 1 && p >= total) dirRef.current = -1
    else if (dirRef.current === -1 && p <= 1) dirRef.current = 1
    return Math.max(1, Math.min(total, p + dirRef.current))
  }
  // forward (default) — wrap at the end
  return (p % total) + 1
}
