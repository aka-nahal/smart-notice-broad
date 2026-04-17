"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import api from "@/lib/api-client"
import type { MediaAsset } from "@/lib/types"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAssets = useCallback(async () => {
    try {
      const data = await api.media.list()
      setAssets(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  async function handleUpload(file: File) {
    setError(null)
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) { setError("Only image and video files are allowed"); return }
    if (file.size > 100 * 1024 * 1024) { setError("File too large (max 100 MB)"); return }
    setUploading(true)
    try {
      await api.media.upload(file)
      loadAssets()
    } catch (e) {
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
    } catch (e) { console.error(e) }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Media Library</h1>
        <p className="mt-1 text-sm text-zinc-500">{assets.length} file{assets.length !== 1 ? "s" : ""} uploaded</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`mb-6 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors ${
          dragOver ? "border-blue-400 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30"
        }`}
      >
        {uploading ? (
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
            <span className="text-sm text-zinc-400">Uploading...</span>
          </div>
        ) : (
          <>
            <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div>
              <p className="text-sm text-zinc-300">Drop images or videos here or click to upload</p>
              <p className="text-xs text-zinc-600">JPG, PNG, GIF, WebP, MP4, WebM, MOV &middot; Max 100 MB per file</p>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
              <p className="text-sm text-zinc-500">No media uploaded yet.</p>
              <p className="mt-1 text-xs text-zinc-600">Upload images to use them in your layouts.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {assets.map((asset) => (
                <button key={asset.id} onClick={() => setSelected(asset)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:opacity-90 ${
                    selected?.id === asset.id ? "border-blue-400 ring-1 ring-blue-400/50" : "border-zinc-800"
                  }`}>
                  {asset.kind === "video" ? (
                    <>
                      <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-black/60 p-2">
                          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  {asset.kind === "video" && (
                    <div className="absolute left-1.5 bottom-1.5">
                      <span className="text-[8px] bg-pink-500/80 text-white px-1 rounded">VIDEO</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-3 aspect-video overflow-hidden rounded-lg border border-zinc-800">
              {selected.kind === "video" ? (
                <video src={selected.url} controls muted playsInline className="h-full w-full object-contain bg-zinc-900" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.url} alt={selected.filename} className="h-full w-full object-contain bg-zinc-900" />
              )}
            </div>
            <h3 className="truncate text-sm font-medium text-zinc-200">{selected.filename}</h3>
            <div className="mt-2 space-y-1 text-xs text-zinc-500">
              <p>Type: {selected.mime_type}</p>
              <p>Size: {formatBytes(selected.bytes_size)}</p>
              <p>ID: {selected.id}</p>
              <p>Uploaded: {new Date(selected.created_at).toLocaleDateString()}</p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded bg-zinc-800 px-2 py-1.5">
                <p className="text-[10px] text-zinc-500">Media URL</p>
                <p className="mt-0.5 truncate font-mono text-xs text-zinc-300">{selected.url}</p>
              </div>
              <button onClick={() => handleDelete(selected.id)}
                className="w-full rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20">
                Delete {selected.kind === "video" ? "Video" : "Image"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
