"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import api from "@/lib/api-client"
import type { MediaAsset } from "@/lib/types"
import { BrandedLoader } from "@/components/skeleton"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

type Kind = "image" | "video" | "pdf"
type Category = "all" | Kind

interface Stats {
  total_bytes: number
  total_count: number
  quota_bytes: number
  by_kind: Record<string, { count: number; bytes: number }>
}

const CATEGORIES: { key: Category; label: string; icon: string; mime: string }[] = [
  { key: "all",   label: "All",       icon: "▦", mime: "image/*,video/*,application/pdf" },
  { key: "image", label: "Images",    icon: "🖼", mime: "image/*" },
  { key: "video", label: "Videos",    icon: "🎬", mime: "video/*" },
  { key: "pdf",   label: "Documents", icon: "📄", mime: "application/pdf" },
]

export default function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const [category, setCategory] = useState<Category>("all")
  const [search, setSearch] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAll = useCallback(async () => {
    try {
      const [data, sRes] = await Promise.all([
        api.media.list(),
        fetch("/api/media/_/stats").then((r) => r.ok ? r.json() : null).catch(() => null),
      ])
      setAssets(data)
      if (sRes) setStats(sRes)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleUpload(file: File) {
    setError(null)
    const ok = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf"
    if (!ok) { setError("Only images, videos, and PDFs are allowed"); return }
    if (file.size > 100 * 1024 * 1024) { setError("File too large (max 100 MB)"); return }
    setUploading(true)
    try {
      await api.media.upload(file)
      loadAll()
    } catch {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach((f) => handleUpload(f))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((f) => handleUpload(f))
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleDelete(id: number) {
    try {
      await api.media.delete(id)
      setAssets((prev) => prev.filter((a) => a.id !== id))
      if (selected?.id === id) setSelected(null)
      // Refresh stats after delete
      fetch("/api/media/_/stats").then((r) => r.ok ? r.json() : null).then((s) => s && setStats(s)).catch(() => null)
    } catch (e) { console.error(e) }
  }

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (category !== "all" && a.kind !== category) return false
      if (search && !a.filename.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [assets, category, search])

  // Per-category counts for the tab badges
  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: assets.length, image: 0, video: 0, pdf: 0 }
    for (const a of assets) {
      if (a.kind === "image") c.image++
      else if (a.kind === "video") c.video++
      else if (a.kind === "pdf") c.pdf++
    }
    return c
  }, [assets])

  const acceptForUpload = CATEGORIES.find((c) => c.key === category)?.mime ?? "image/*,video/*,application/pdf"

  if (loading) return <BrandedLoader message="Loading media library…" />

  const usedPct = stats ? Math.min(100, (stats.total_bytes / Math.max(1, stats.quota_bytes)) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Media Library</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {stats ? `${stats.total_count} file${stats.total_count !== 1 ? "s" : ""} · ${formatBytes(stats.total_bytes)} of ${formatBytes(stats.quota_bytes)} used` : `${assets.length} files`}
          </p>
        </div>
      </div>

      {/* Storage usage card */}
      {stats && (
        <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Storage</p>
            <span className={`text-xs tabular-nums font-medium ${usedPct > 80 ? "text-amber-500" : "text-zinc-600 dark:text-zinc-400"}`}>
              {usedPct.toFixed(1)}% used
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                usedPct > 90 ? "bg-red-500" : usedPct > 80 ? "bg-amber-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["image", "video", "pdf"] as Kind[]).map((k) => {
              const bucket = stats.by_kind[k]
              const count = bucket?.count ?? 0
              const bytes = bucket?.bytes ?? 0
              return (
                <div key={k} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2 border border-zinc-200/50 dark:border-zinc-700/50">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">{k}s</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">{count}</p>
                  <p className="text-[10px] text-zinc-500 tabular-nums">{formatBytes(bytes)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`mb-6 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-500/10"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
        }`}
      >
        {uploading ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-400" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Uploading…</span>
          </div>
        ) : (
          <>
            <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Drop files here or click to upload</p>
              <p className="text-xs text-zinc-500">Images, videos, PDFs · Max 100 MB per file</p>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept={acceptForUpload} multiple className="hidden" onChange={handleFileChange} />
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {/* Category tabs + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-0.5">
          {CATEGORIES.map((c) => {
            const isActive = category === c.key
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <span>{c.icon}</span>{c.label}
                <span className={`tabular-nums text-[10px] rounded px-1 ${isActive ? "bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-400" : "text-zinc-500"}`}>
                  {counts[c.key]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="relative ml-auto">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename…"
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-8 pr-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:border-blue-400 w-56"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center">
              <p className="text-sm text-zinc-500">{search ? `No files matching "${search}"` : "No files in this category yet."}</p>
              {!search && <p className="mt-1 text-xs text-zinc-500">Upload to use them in your layouts.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelected(asset)}
                  className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.02] ${
                    selected?.id === asset.id ? "border-blue-500 ring-2 ring-blue-400/40" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  {asset.kind === "video" ? (
                    <>
                      <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                        <div className="rounded-full bg-black/60 p-2">
                          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </>
                  ) : asset.kind === "pdf" ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-rose-500/10">
                      <span className="text-3xl">📄</span>
                      <span className="text-[10px] font-mono text-rose-700 dark:text-rose-300 truncate max-w-full px-2">{asset.filename}</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {/* kind badge */}
                  <div className="absolute left-1.5 bottom-1.5">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider text-white ${
                      asset.kind === "video" ? "bg-pink-500/85" :
                      asset.kind === "pdf"   ? "bg-rose-500/85"  :
                                               "bg-emerald-500/85"
                    }`}>{asset.kind}</span>
                  </div>
                  <div className="absolute right-1.5 bottom-1.5 text-[8px] tabular-nums bg-black/50 text-white/90 px-1 rounded">
                    {formatBytes(asset.bytes_size)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 self-start sticky top-4">
            <div className="mb-3 aspect-video overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              {selected.kind === "video" ? (
                <video src={selected.url} controls muted playsInline className="h-full w-full object-contain bg-zinc-900" />
              ) : selected.kind === "pdf" ? (
                <div className="flex h-full w-full items-center justify-center bg-rose-500/10">
                  <span className="text-5xl">📄</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.url} alt={selected.filename} className="h-full w-full object-contain bg-zinc-100 dark:bg-zinc-900" />
              )}
            </div>
            <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{selected.filename}</h3>
            <div className="mt-2 space-y-1 text-xs text-zinc-500">
              <p>Type: <span className="font-mono text-zinc-700 dark:text-zinc-400">{selected.mime_type}</span></p>
              <p>Size: <span className="tabular-nums text-zinc-700 dark:text-zinc-400">{formatBytes(selected.bytes_size)}</span></p>
              <p>ID: <span className="tabular-nums text-zinc-700 dark:text-zinc-400">{selected.id}</span></p>
              <p>Uploaded: <span className="text-zinc-700 dark:text-zinc-400">{new Date(selected.created_at).toLocaleString()}</span></p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 border border-zinc-200 dark:border-zinc-700/50">
                <p className="text-[10px] text-zinc-500">Media URL</p>
                <p className="mt-0.5 truncate font-mono text-xs text-zinc-700 dark:text-zinc-300">{selected.url}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(window.location.origin + selected.url)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Copy URL
              </button>
              <button
                onClick={() => handleDelete(selected.id)}
                className="w-full rounded-lg border border-red-300/50 dark:border-red-500/20 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
