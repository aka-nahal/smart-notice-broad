"use client"

/**
 * Visual media picker — a thumbnail grid for selecting images / videos / pdfs
 * from the media library. Used by the screen saver settings to pick still
 * images and slideshow media without typing IDs.
 */

import { useEffect, useMemo, useState } from "react"
import api from "@/lib/api-client"
import type { MediaAsset } from "@/lib/types"

interface Props {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  /** Restrict to one kind. Omit to allow any. */
  kind?: "image" | "video" | "pdf"
  /** Cap the number of selectable items. */
  multiple?: boolean
  disabled?: boolean
}

export function MediaPicker({ selectedIds, onChange, kind, multiple = true, disabled = false }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    api.media.list()
      .then((data) => { if (!cancelled) setAssets(data) })
      .catch(() => { if (!cancelled) setError("Failed to load media") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    return assets
      .filter((a) => (kind ? a.kind === kind : true))
      .filter((a) => (search ? a.filename.toLowerCase().includes(search.toLowerCase()) : true))
  }, [assets, kind, search])

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggle(id: number) {
    if (disabled) return
    if (multiple) {
      const next = selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
      onChange(next)
    } else {
      onChange(selected.has(id) ? [] : [id])
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {multiple ? `Selected ${selectedIds.length}` : selectedIds.length ? "Selected 1" : "Select an image"}
        </p>
        {selectedIds.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-[10px] text-zinc-500 hover:text-red-500 disabled:opacity-30"
          >
            Clear
          </button>
        )}
        <a href="/admin/media" target="_blank"
          className="ml-auto text-[10px] text-blue-500 hover:underline">
          Manage media &nearr;
        </a>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search filename…"
          disabled={disabled}
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-7 pr-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400 disabled:opacity-50"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-zinc-200/60 dark:bg-zinc-800/60 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-red-500 py-4 text-center">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-zinc-500 py-6 text-center">
          {search ? `No ${kind ?? "media"} matching "${search}"` : `No ${kind ?? "media"} uploaded yet.`}
          {!search && (
            <>
              {" "}
              <a href="/admin/media" target="_blank" className="text-blue-500 hover:underline">Upload one</a>.
            </>
          )}
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
          {filtered.map((asset) => {
            const isSelected = selected.has(asset.id)
            const order = isSelected ? selectedIds.indexOf(asset.id) + 1 : 0
            return (
              <button
                key={asset.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(asset.id)}
                title={asset.filename}
                className={`group relative aspect-square overflow-hidden rounded-md border-2 transition-all disabled:opacity-50 ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-400/40"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:scale-[1.03]"
                }`}
              >
                {asset.kind === "video" ? (
                  <>
                    <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="rounded-full bg-black/60 p-1">
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </>
                ) : asset.kind === "pdf" ? (
                  <div className="flex h-full w-full items-center justify-center bg-rose-500/10">
                    <span className="text-2xl">📄</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
                {isSelected && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm">
                    {multiple ? order : "✓"}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
