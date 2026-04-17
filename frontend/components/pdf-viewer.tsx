"use client"

import { useEffect, useState } from "react"

interface Props {
  url: string
  /** Auto-advance pages every N seconds (0 disables). */
  autoAdvanceSec?: number
  /** Initial page (1-based). */
  page?: number
  /** Total pages — if known the viewer shows N/total and can wrap. If unknown the
   *  viewer just relies on the browser's PDF chrome and disables auto-advance. */
  totalPages?: number
  /** Show overlay chrome (page counter + arrows). */
  showChrome?: boolean
  /** Fit mode passed to the PDF object viewer. */
  fit?: "page" | "width" | "height"
}

/**
 * Lightweight PDF viewer that uses the browser's built-in PDF renderer via
 * `<object>` (works in all major browsers without bundling pdf.js). Supports
 * auto page advancement using PDF open params (#page=N) and a small chrome
 * overlay. Falls back to a download link if PDF rendering is unsupported.
 */
export function PdfViewer({
  url,
  autoAdvanceSec = 0,
  page = 1,
  totalPages,
  showChrome = true,
  fit = "page",
}: Props) {
  const [current, setCurrent] = useState(Math.max(1, page))

  // Auto-advance pages only if total is known.
  useEffect(() => {
    if (!autoAdvanceSec || autoAdvanceSec <= 0) return
    if (!totalPages || totalPages <= 1) return
    const id = setInterval(() => {
      setCurrent((p) => (p % totalPages) + 1)
    }, autoAdvanceSec * 1000)
    return () => clearInterval(id)
  }, [autoAdvanceSec, totalPages])

  // PDF open parameters: page=N, view=Fit / FitH / FitV. Toolbar/navpanes off.
  const view = fit === "width" ? "FitH" : fit === "height" ? "FitV" : "Fit"
  const src = `${url}#page=${current}&view=${view}&toolbar=0&navpanes=0&statusbar=0`

  function next() {
    if (totalPages) setCurrent((p) => (p % totalPages) + 1)
    else setCurrent((p) => p + 1)
  }
  function prev() {
    if (totalPages) setCurrent((p) => ((p - 2 + totalPages) % totalPages) + 1)
    else setCurrent((p) => Math.max(1, p - 1))
  }

  return (
    <div className="relative h-full w-full bg-zinc-100 dark:bg-zinc-900">
      <object
        key={src}
        data={src}
        type="application/pdf"
        className="h-full w-full"
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
          <button onClick={prev} className="rounded-full px-1 hover:bg-white/10" title="Previous page">‹</button>
          <span className="tabular-nums">{current}{totalPages ? ` / ${totalPages}` : ""}</span>
          <button onClick={next} className="rounded-full px-1 hover:bg-white/10" title="Next page">›</button>
        </div>
      )}
    </div>
  )
}
