"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface MediaItem {
  id: number
  url: string
  kind: string
  mime_type: string
  bytes_size: number
  filename: string
  created_at: string
}

// ---------------------------------------------------------------------------
// YouTube helpers
// ---------------------------------------------------------------------------

/** Extract YouTube video ID from any common URL format */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare ID
  ]
  for (const p of patterns) {
    const m = url.trim().match(p)
    if (m) return m[1]
  }
  return null
}

function youtubeEmbedUrl(id: string, autoplay: boolean, loop: boolean): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: "1",
    loop: loop ? "1" : "0",
    playlist: id, // required for loop to work
    controls: "0",
    modestbranding: "1",
    rel: "0",
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

export function getYouTubeEmbedUrl(url: string, autoplay = true, loop = true): string | null {
  const id = extractYouTubeId(url)
  if (!id) return null
  return youtubeEmbedUrl(id, autoplay, loop)
}

export function getYouTubeId(url: string): string | null {
  return extractYouTubeId(url)
}

// ---------------------------------------------------------------------------
// Bytes formatter
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  currentMediaId: number | null
  currentVideoUrl: string | null
  disabled?: boolean
  onSelectMedia: (mediaId: number) => void
  onSetVideoUrl: (url: string) => void
  onClear: () => void
}

export function VideoUpload({ currentMediaId, currentVideoUrl, disabled, onSelectMedia, onSetVideoUrl, onClear }: Props) {
  const [tab, setTab] = useState<"upload" | "library" | "url" | "youtube">(
    currentVideoUrl && isYouTubeUrl(currentVideoUrl) ? "youtube"
    : currentMediaId ? "library"
    : currentVideoUrl ? "url"
    : "upload"
  )
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [urlInput, setUrlInput] = useState(currentVideoUrl && !isYouTubeUrl(currentVideoUrl) ? currentVideoUrl : "")
  const [ytInput, setYtInput] = useState(currentVideoUrl && isYouTubeUrl(currentVideoUrl) ? currentVideoUrl : "")
  const fileRef = useRef<HTMLInputElement>(null)

  const loadLibrary = useCallback(async () => {
    setLoadingLib(true)
    try {
      const res = await fetch("/api/media")
      if (res.ok) {
        const all: MediaItem[] = await res.json()
        setLibrary(all.filter((m) => m.kind === "video"))
      }
    } catch { /* ignore */ }
    finally { setLoadingLib(false) }
  }, [])

  useEffect(() => {
    if (tab === "library") loadLibrary()
  }, [tab, loadLibrary])

  async function handleUpload(file: File) {
    setError(null)
    if (!file.type.startsWith("video/")) {
      setError("Only video files are allowed (MP4, WebM, MOV)")
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("File too large (max 100 MB)")
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
      onSelectMedia(data.id)
      setTab("library")
      loadLibrary()
    } catch {
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

  function applyUrl() {
    if (urlInput.trim()) onSetVideoUrl(urlInput.trim())
  }

  function applyYoutube() {
    if (ytInput.trim()) {
      const id = extractYouTubeId(ytInput.trim())
      if (id) {
        onSetVideoUrl(ytInput.trim())
      } else {
        setError("Could not parse YouTube URL. Try a standard youtube.com/watch?v=... link.")
      }
    }
  }

  const ytId = currentVideoUrl ? extractYouTubeId(currentVideoUrl) : null
  const previewSrc = currentMediaId ? `/api/media/${currentMediaId}` : (!ytId && currentVideoUrl) ? currentVideoUrl : null

  const tabs = ["upload", "library", "url", "youtube"] as const
  const tabLabels = { upload: "Upload", library: "Library", url: "URL", youtube: "YouTube" }

  return (
    <div className="flex flex-col gap-2">
      {/* Current preview */}
      {(previewSrc || ytId) && (
        <div className="relative h-28 w-full overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {ytId ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={youtubeThumbnail(ytId)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="rounded-lg bg-red-600 px-2 py-1 flex items-center gap-1">
                  <svg className="h-3 w-3 text-zinc-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  <span className="text-[10px] font-bold text-zinc-900 dark:text-white">YouTube</span>
                </div>
              </div>
              <span className="absolute bottom-1 left-2 text-[9px] text-zinc-900 dark:text-white/60 bg-black/50 px-1 rounded">{ytId}</span>
            </div>
          ) : previewSrc ? (
            <>
              <video src={previewSrc} className="h-full w-full object-cover" muted autoPlay loop playsInline preload="auto" />
              <span className="absolute bottom-1 left-2 text-[9px] text-zinc-900 dark:text-white/60 bg-black/50 px-1 rounded">
                {currentMediaId ? `Media #${currentMediaId}` : "External URL"}
              </span>
            </>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 p-0.5 gap-0.5">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} disabled={disabled}
            className={`flex-1 rounded-md px-1 py-1 text-[9px] font-medium transition-colors ${
              tab === t ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            } disabled:opacity-50`}>
            {tabLabels[t]}
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
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 transition-colors ${
            dragOver ? "border-pink-400 bg-pink-500/10" : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-100/30 dark:hover:bg-zinc-800/30"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 dark:border-zinc-600 border-t-pink-400" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Uploading...</span>
            </div>
          ) : (
            <>
              <span className="text-2xl">🎬</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Drop video here or click to browse</span>
              <span className="text-[10px] text-zinc-600">MP4, WebM, MOV &middot; Max 100 MB</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {/* Library tab */}
      {tab === "library" && (
        <div className="flex flex-col gap-2">
          {loadingLib ? (
            <div className="py-4 text-center text-xs text-zinc-500">Loading...</div>
          ) : library.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-600">
              No videos uploaded yet.
              <button onClick={() => setTab("upload")} className="ml-1 text-pink-400 hover:underline">Upload one</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {library.map((m) => (
                <button key={m.id} onClick={() => onSelectMedia(m.id)} disabled={disabled}
                  className={`relative aspect-video overflow-hidden rounded-lg border-2 transition-all hover:opacity-90 ${
                    currentMediaId === m.id ? "border-pink-400 ring-1 ring-pink-400/50" : "border-zinc-300 dark:border-zinc-700"
                  } disabled:opacity-50`}>
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg className="h-4 w-4 text-zinc-900 dark:text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[7px] text-zinc-900 dark:text-white/70">
                    {formatBytes(m.bytes_size)}
                  </div>
                  {currentMediaId === m.id && (
                    <div className="absolute top-1 right-1 rounded bg-pink-500 px-1 py-0.5 text-[7px] font-bold text-zinc-900 dark:text-white">SELECTED</div>
                  )}
                </button>
              ))}
            </div>
          )}
          <button onClick={loadLibrary} disabled={loadingLib}
            className="text-[10px] text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 disabled:opacity-30">
            Refresh library
          </button>
        </div>
      )}

      {/* Direct URL tab */}
      {tab === "url" && (
        <div className="flex flex-col gap-2">
          <input value={urlInput} disabled={disabled}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={applyUrl}
            onKeyDown={(e) => { if (e.key === "Enter") applyUrl() }}
            placeholder="https://example.com/video.mp4"
            className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-pink-500/50 disabled:opacity-50" />
          <p className="text-[10px] text-zinc-600">Paste a direct video file URL (.mp4, .webm). Press Enter to apply.</p>
        </div>
      )}

      {/* YouTube tab */}
      {tab === "youtube" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-red-900/10 border border-red-500/15 px-2.5 py-2">
            <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white" />
            </svg>
            <span className="text-[11px] text-red-400 font-medium">YouTube Video</span>
          </div>
          <input value={ytInput} disabled={disabled}
            onChange={(e) => setYtInput(e.target.value)}
            onBlur={applyYoutube}
            onKeyDown={(e) => { if (e.key === "Enter") applyYoutube() }}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-red-500/50 disabled:opacity-50 font-mono text-xs" />
          <p className="text-[10px] text-zinc-600">
            Supports: youtube.com/watch, youtu.be, youtube.com/shorts, or just the video ID.
          </p>
          {ytInput && extractYouTubeId(ytInput) && (
            <div className="rounded-md bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 p-2 text-[10px] text-zinc-600 dark:text-zinc-400">
              Detected ID: <code className="text-pink-400">{extractYouTubeId(ytInput)}</code>
            </div>
          )}
        </div>
      )}

      {/* Clear button */}
      {(currentMediaId || currentVideoUrl) && (
        <button onClick={onClear} disabled={disabled}
          className="text-[10px] text-red-400/70 hover:text-red-400 disabled:opacity-30">
          Remove video
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
