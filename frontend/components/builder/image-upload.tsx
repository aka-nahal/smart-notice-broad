"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface MediaItem {
  id: number
  url: string
  kind: string
  mime_type: string
  bytes_size: number
  filename: string
  created_at: string
}

interface Props {
  currentMediaId: number | null
  currentImageUrl: string | null
  disabled?: boolean
  onSelectMedia: (mediaId: number, url: string) => void
  onSetImageUrl: (url: string) => void
}

export function ImageUpload({ currentMediaId, currentImageUrl, disabled, onSelectMedia, onSetImageUrl }: Props) {
  const [tab, setTab] = useState<"upload" | "library" | "url">(currentMediaId ? "library" : currentImageUrl ? "url" : "upload")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [urlInput, setUrlInput] = useState(currentImageUrl ?? "")
  const fileRef = useRef<HTMLInputElement>(null)

  const loadLibrary = useCallback(async () => {
    setLoadingLib(true)
    try {
      const res = await fetch("/api/media")
      if (res.ok) setLibrary(await res.json())
    } catch { /* ignore */ }
    finally { setLoadingLib(false) }
  }, [])

  useEffect(() => {
    if (tab === "library") loadLibrary()
  }, [tab, loadLibrary])

  async function handleUpload(file: File) {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB)")
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/media", { method: "POST", body: form })
      if (!res.ok) {
        const text = await res.text()
        setError(text || "Upload failed")
        return
      }
      const data: MediaItem & { duplicate: boolean } = await res.json()
      onSelectMedia(data.id, data.url)
      setTab("library")
      loadLibrary()
    } catch (e) {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileRef.current) fileRef.current.value = ""
  }

  const previewUrl = currentMediaId
    ? `/api/media/${currentMediaId}`
    : currentImageUrl || null

  return (
    <div className="flex flex-col gap-2">
      {/* Current preview */}
      {previewUrl && (
        <div className="relative h-24 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-1 left-2 text-[10px] text-white/70">
            {currentMediaId ? `Media #${currentMediaId}` : "External URL"}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-lg bg-zinc-800/50 p-0.5">
        {(["upload", "library", "url"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} disabled={disabled}
            className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              tab === t ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
            } disabled:opacity-50`}>
            {t === "upload" ? "Upload" : t === "library" ? "Library" : "URL"}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragOver ? "border-blue-400 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
              <span className="text-xs text-zinc-400">Uploading...</span>
            </div>
          ) : (
            <>
              <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-xs text-zinc-400">Drop image here or click to browse</span>
              <span className="text-[10px] text-zinc-600">JPG, PNG, GIF, WebP &middot; Max 10 MB</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {/* Library tab */}
      {tab === "library" && (
        <div className="flex flex-col gap-2">
          {loadingLib ? (
            <div className="py-4 text-center text-xs text-zinc-500">Loading...</div>
          ) : library.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-600">
              No images uploaded yet.
              <button onClick={() => setTab("upload")} className="ml-1 text-blue-400 hover:underline">Upload one</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {library.map((m) => (
                <button key={m.id} onClick={() => onSelectMedia(m.id, m.url)} disabled={disabled}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:opacity-90 ${
                    currentMediaId === m.id ? "border-blue-400 ring-1 ring-blue-400/50" : "border-zinc-700"
                  } disabled:opacity-50`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {currentMediaId === m.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                      <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[8px] font-bold text-white">SELECTED</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          <button onClick={loadLibrary} disabled={loadingLib}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 disabled:opacity-30">
            Refresh library
          </button>
        </div>
      )}

      {/* URL tab */}
      {tab === "url" && (
        <div className="flex flex-col gap-2">
          <input value={urlInput} disabled={disabled}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={() => onSetImageUrl(urlInput)}
            onKeyDown={(e) => { if (e.key === "Enter") onSetImageUrl(urlInput) }}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50" />
          <p className="text-[10px] text-zinc-600">Paste any public image URL. Press Enter to apply.</p>
        </div>
      )}

      {/* Clear button */}
      {(currentMediaId || currentImageUrl) && (
        <button onClick={() => { onSelectMedia(0, ""); onSetImageUrl(""); setUrlInput("") }} disabled={disabled}
          className="text-[10px] text-red-400/70 hover:text-red-400 disabled:opacity-30">
          Remove image
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
