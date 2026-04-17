"use client"

import { useEffect, useRef, useState } from "react"
import type { TileRead, TileUpdate, NoticeRead } from "@/lib/types"
import { TILE_TYPES } from "@/lib/types"
import type { GridSpec } from "@/lib/grid-engine"
import { ImageUpload } from "./image-upload"
import { VideoUpload, isYouTubeUrl } from "./video-upload"
import { parseSlides, stringifySlides, type CarouselSlide } from "@/components/carousel-widget"

const inputCls = "w-full rounded-md bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 border border-zinc-700 focus:border-blue-500/50"
const selectCls = inputCls

function Section({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer items-center gap-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 select-none">
        <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {label}
      </summary>
      <div className="ml-1 space-y-2 pb-2">{children}</div>
    </details>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function NumField({ label, value, min, max, onChange, disabled = false }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean
}) {
  return (
    <Field label={label}>
      <input type="number" value={value} min={min} max={max} disabled={disabled}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n))) }}
        className={inputCls + " tabular-nums"} />
    </Field>
  )
}

function ColorField({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value || "#ffffff"} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent disabled:opacity-50" />
        <input value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className={inputCls + " font-mono text-xs flex-1"} />
        {value && (
          <button onClick={() => onChange("")} disabled={disabled}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-30">&times;</button>
        )}
      </div>
    </Field>
  )
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

interface Props {
  tile: TileRead
  notices: NoticeRead[]
  spec: GridSpec
  isLocked: boolean
  onUpdate: (field: keyof TileUpdate, value: number | string | boolean | null) => void
  onDelete: () => void
  onMove: () => void
  onDuplicate: () => void
  onToggleLock: () => void
  onCreateNotice: (title: string, body: string) => void
}

export function TileInspector({ tile, notices, spec, isLocked, onUpdate, onDelete, onMove, onDuplicate, onToggleLock, onCreateNotice }: Props) {
  const config = parseConfig(tile.config_json)

  function updateConfig(key: string, value: string | number | undefined) {
    const c = { ...config }
    if (value === undefined || value === "") delete c[key]
    else c[key] = value
    const json = Object.keys(c).length > 0 ? JSON.stringify(c) : null
    onUpdate("config_json", json)
  }

  const [showNewNotice, setShowNewNotice] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newBody, setNewBody] = useState("")

  const type = tile.tile_type

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{TILE_TYPES.find((t) => t.value === type)?.icon ?? "?"}</span>
          <div>
            <p className="text-xs font-semibold text-zinc-300">Tile #{tile.id}</p>
            <p className="text-[10px] text-zinc-600">{tile.grid_w}&times;{tile.grid_h} at ({tile.grid_x},{tile.grid_y})</p>
          </div>
        </div>
        {isLocked && (
          <span className="rounded bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 border border-amber-500/20">
            Locked
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 mb-2">
        <button onClick={onMove} disabled={isLocked}
          className="flex-1 rounded-md bg-zinc-800 py-1.5 text-[10px] text-blue-400 hover:bg-zinc-700 disabled:opacity-30 border border-zinc-700 hover:border-blue-500/30 transition-colors">
          Move
        </button>
        <button onClick={onDuplicate}
          className="flex-1 rounded-md bg-zinc-800 py-1.5 text-[10px] text-zinc-400 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-colors">
          Copy
        </button>
        <button onClick={onToggleLock}
          className="flex-1 rounded-md bg-zinc-800 py-1.5 text-[10px] text-amber-400 hover:bg-zinc-700 border border-zinc-700 hover:border-amber-500/30 transition-colors">
          {isLocked ? "Unlock" : "Lock"}
        </button>
        <button onClick={onDelete} disabled={isLocked}
          className="flex-1 rounded-md bg-zinc-800 py-1.5 text-[10px] text-red-400 hover:bg-red-900/20 disabled:opacity-30 border border-zinc-700 hover:border-red-500/30 transition-colors">
          Delete
        </button>
      </div>

      {/* Type selector */}
      <Field label="Tile Type">
        <select value={type} onChange={(e) => onUpdate("tile_type", e.target.value)} disabled={isLocked} className={selectCls}>
          {TILE_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.icon} {tt.label}</option>)}
        </select>
      </Field>

      {/* Content section */}
      <Section label="Content">
        {(type === "notice" || type === "event" || type === "emergency") && (
          <>
            <Field label="Assign Notice">
              <select value={tile.notice_id ?? ""} disabled={isLocked}
                onChange={(e) => { const v = e.target.value; onUpdate("notice_id", v ? Number(v) : null) }}
                className={selectCls}>
                <option value="">&mdash; none &mdash;</option>
                {notices.map((n) => <option key={n.id} value={n.id}>{n.title || `Notice #${n.id}`}</option>)}
              </select>
            </Field>
            {!showNewNotice ? (
              <button onClick={() => setShowNewNotice(true)} disabled={isLocked}
                className="rounded-md border border-dashed border-zinc-700 px-2 py-2 text-xs text-zinc-500 hover:border-blue-500/30 hover:text-blue-400 disabled:opacity-30 transition-colors">
                + Create new notice inline
              </button>
            ) : (
              <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5 space-y-2">
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Notice title"
                  className={inputCls} />
                <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Notice body text" rows={3}
                  className={inputCls} />
                <div className="flex gap-1">
                  <button disabled={!newTitle.trim()} onClick={() => {
                    onCreateNotice(newTitle.trim(), newBody.trim() || newTitle.trim())
                    setNewTitle(""); setNewBody(""); setShowNewNotice(false)
                  }} className="rounded-md bg-blue-600 px-3 py-1 text-[10px] text-white hover:bg-blue-500 disabled:opacity-30">
                    Create &amp; Assign
                  </button>
                  <button onClick={() => { setShowNewNotice(false); setNewTitle(""); setNewBody("") }}
                    className="rounded-md px-3 py-1 text-[10px] text-zinc-500 hover:bg-zinc-700">Cancel</button>
                </div>
              </div>
            )}
          </>
        )}

        {type === "ticker" && (
          <Field label="Ticker Text">
            <textarea value={(config.tickerText as string) ?? ""} disabled={isLocked}
              onChange={(e) => updateConfig("tickerText", e.target.value)}
              placeholder="Welcome to the Smart Notice Board..." rows={3}
              className={inputCls} />
          </Field>
        )}

        {type === "banner" && (
          <>
            <Field label="Banner Title">
              <input value={(config.bannerTitle as string) ?? ""} disabled={isLocked}
                onChange={(e) => updateConfig("bannerTitle", e.target.value)}
                placeholder="Smart Notice Board" className={inputCls} />
            </Field>
            <Field label="Subtitle">
              <input value={(config.bannerSubtitle as string) ?? ""} disabled={isLocked}
                onChange={(e) => updateConfig("bannerSubtitle", e.target.value)}
                placeholder="AI-Powered Campus Display" className={inputCls} />
            </Field>
          </>
        )}

        {type === "image" && (
          <>
            <ImageUpload
              currentMediaId={tile.media_id}
              currentImageUrl={(config.imageUrl as string) ?? null}
              disabled={isLocked}
              onSelectMedia={(mediaId) => {
                if (mediaId > 0) {
                  onUpdate("media_id", mediaId)
                  const c = { ...config }; delete c.imageUrl
                  const json = Object.keys(c).length > 0 ? JSON.stringify(c) : null
                  onUpdate("config_json", json)
                } else { onUpdate("media_id", null) }
              }}
              onSetImageUrl={(url) => {
                updateConfig("imageUrl", url || undefined)
                if (url) onUpdate("media_id", null)
              }}
            />
            <Field label="Alt Text">
              <input value={(config.imageAlt as string) ?? ""} disabled={isLocked}
                onChange={(e) => updateConfig("imageAlt", e.target.value)}
                placeholder="Description of image" className={inputCls} />
            </Field>
            <Field label="Fit Mode">
              <select value={(config.imageFit as string) ?? "cover"} disabled={isLocked}
                onChange={(e) => updateConfig("imageFit", e.target.value)} className={selectCls}>
                <option value="cover">Cover (fill, may crop)</option>
                <option value="contain">Contain (letterbox, no crop)</option>
                <option value="fill">Fill (stretch to size)</option>
              </select>
            </Field>
          </>
        )}

        {type === "video" && (
          <>
            <VideoUpload
              currentMediaId={tile.media_id}
              currentVideoUrl={(config.videoUrl as string) ?? null}
              disabled={isLocked}
              onSelectMedia={(mediaId) => {
                onUpdate("media_id", mediaId)
                const c = { ...config }; delete c.videoUrl
                const json = Object.keys(c).length > 0 ? JSON.stringify(c) : null
                onUpdate("config_json", json)
              }}
              onSetVideoUrl={(url) => {
                updateConfig("videoUrl", url || undefined)
                if (url) onUpdate("media_id", null)
              }}
              onClear={() => {
                onUpdate("media_id", null)
                const c = { ...config }; delete c.videoUrl
                const json = Object.keys(c).length > 0 ? JSON.stringify(c) : null
                onUpdate("config_json", json)
              }}
            />

            {/* YouTube indicator */}
            {(config.videoUrl as string) && isYouTubeUrl(config.videoUrl as string) && (
              <div className="rounded-md bg-red-900/10 border border-red-500/15 px-2.5 py-1.5 text-[10px] text-red-400">
                YouTube video will be embedded as an iframe on the display.
              </div>
            )}

            <Field label="Poster Image URL">
              <input value={(config.videoPoster as string) ?? ""} disabled={isLocked}
                onChange={(e) => updateConfig("videoPoster", e.target.value || undefined)}
                placeholder="Thumbnail shown before play" className={inputCls} />
            </Field>

            <Field label="Fit Mode">
              <select value={(config.videoFit as string) ?? "cover"} disabled={isLocked}
                onChange={(e) => updateConfig("videoFit", e.target.value)} className={selectCls}>
                <option value="cover">Cover (fill, may crop)</option>
                <option value="contain">Contain (letterbox, no crop)</option>
                <option value="fill">Fill (stretch to size)</option>
              </select>
            </Field>

            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mt-1">Playback Options</p>
            <div className="space-y-2 py-1">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={config.videoAutoplay !== "false"} disabled={isLocked}
                  onChange={(e) => updateConfig("videoAutoplay", e.target.checked ? undefined : "false")}
                  className="rounded border-zinc-600 bg-zinc-800 text-pink-500 focus:ring-pink-500/50" />
                Autoplay (muted)
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={config.videoLoop !== "false"} disabled={isLocked}
                  onChange={(e) => updateConfig("videoLoop", e.target.checked ? undefined : "false")}
                  className="rounded border-zinc-600 bg-zinc-800 text-pink-500 focus:ring-pink-500/50" />
                Loop
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={!!config.videoControls} disabled={isLocked}
                  onChange={(e) => updateConfig("videoControls", e.target.checked ? "true" : undefined)}
                  className="rounded border-zinc-600 bg-zinc-800 text-pink-500 focus:ring-pink-500/50" />
                Show controls
              </label>
            </div>
          </>
        )}

        {type === "clock" && (
          <div className="rounded-md bg-zinc-800/50 border border-zinc-700 p-2.5 text-xs text-zinc-500">
            Displays current time and date automatically. No configuration needed.
          </div>
        )}

        {type === "weather" && (
          <>
            <div className="flex items-center gap-2 rounded-md bg-teal-900/10 border border-teal-500/15 px-2.5 py-2 mb-1">
              <span className="text-base">🌤️</span>
              <span className="text-[11px] text-teal-400 font-medium">OpenWeather Integration</span>
            </div>
            <Field label="City">
              <input value={(config.weatherCity as string) ?? ""} disabled={isLocked}
                onChange={(e) => updateConfig("weatherCity", e.target.value || undefined)}
                placeholder="London" className={inputCls} />
            </Field>
            <Field label="Units">
              <select value={(config.weatherUnits as string) ?? "metric"} disabled={isLocked}
                onChange={(e) => updateConfig("weatherUnits", e.target.value)} className={selectCls}>
                <option value="metric">Celsius (°C)</option>
                <option value="imperial">Fahrenheit (°F)</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer py-1">
              <input type="checkbox"
                checked={config.weatherShowForecast !== "false" && config.weatherShowForecast !== false}
                disabled={isLocked}
                onChange={(e) => updateConfig("weatherShowForecast", e.target.checked ? undefined : "false")}
                className="rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500/50" />
              Show 3-hour forecast
            </label>
            <p className="text-[10px] text-zinc-600">
              Weather data refreshes every 10 minutes. Requires an OpenWeather API key in backend settings.
            </p>
          </>
        )}

        {type === "carousel" && (
          <CarouselEditor config={config} updateConfig={updateConfig} disabled={isLocked} />
        )}

        {type === "pdf" && (
          <PdfEditor config={config} updateConfig={updateConfig} disabled={isLocked} />
        )}
      </Section>

      {/* Position & Size */}
      <Section label="Position & Size">
        <div className="grid grid-cols-2 gap-2">
          <NumField label="X" value={tile.grid_x} min={0} max={spec.cols - tile.grid_w} onChange={(v) => onUpdate("grid_x", v)} disabled={isLocked} />
          <NumField label="Y" value={tile.grid_y} min={0} max={spec.rows - tile.grid_h} onChange={(v) => onUpdate("grid_y", v)} disabled={isLocked} />
          <NumField label="Width" value={tile.grid_w} min={1} max={spec.cols - tile.grid_x} onChange={(v) => onUpdate("grid_w", v)} disabled={isLocked} />
          <NumField label="Height" value={tile.grid_h} min={1} max={spec.rows - tile.grid_y} onChange={(v) => onUpdate("grid_h", v)} disabled={isLocked} />
        </div>
        <NumField label="Z-Index (layer order)" value={tile.z_index} min={0} max={99} onChange={(v) => onUpdate("z_index", v)} disabled={isLocked} />
      </Section>

      {/* Styling */}
      <Section label="Styling">
        <Field label="Font Family">
          <select value={(config.fontFamily as string) ?? ""} disabled={isLocked}
            onChange={(e) => updateConfig("fontFamily", e.target.value)} className={selectCls}>
            <option value="">Default (DM Sans)</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="system-ui">System UI</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Arial', sans-serif">Arial</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Title Size (px)" value={(config.titleSize as number) ?? 0} min={0} max={72}
            onChange={(v) => updateConfig("titleSize", v || undefined)} disabled={isLocked} />
          <NumField label="Body Size (px)" value={(config.bodySize as number) ?? 0} min={0} max={48}
            onChange={(v) => updateConfig("bodySize", v || undefined)} disabled={isLocked} />
        </div>
        <Field label="Title Weight">
          <select value={(config.titleWeight as string) ?? "semibold"} disabled={isLocked}
            onChange={(e) => updateConfig("titleWeight", e.target.value)} className={selectCls}>
            <option value="normal">Normal</option>
            <option value="medium">Medium</option>
            <option value="semibold">Semibold (default)</option>
            <option value="bold">Bold</option>
            <option value="extrabold">Extra Bold</option>
          </select>
        </Field>
        <Field label="Text Align">
          <div className="grid grid-cols-3 gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" disabled={isLocked}
                onClick={() => updateConfig("textAlign", a === "left" ? undefined : a)}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  ((config.textAlign as string) ?? "left") === a
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                }`}>
                {a === "left" ? "⬅ Left" : a === "center" ? "↔ Center" : "Right ➡"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Vertical Align">
          <div className="grid grid-cols-3 gap-1">
            {(["top", "center", "bottom"] as const).map((a) => (
              <button key={a} type="button" disabled={isLocked}
                onClick={() => updateConfig("verticalAlign", a === "top" ? undefined : a)}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  ((config.verticalAlign as string) ?? "top") === a
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                }`}>
                {a === "top" ? "⬆ Top" : a === "center" ? "↕ Middle" : "⬇ Bottom"}
              </button>
            ))}
          </div>
        </Field>
        <NumField label="Padding (px)" value={(config.padding as number) ?? 0} min={0} max={64}
          onChange={(v) => updateConfig("padding", v || undefined)} disabled={isLocked} />
        <ColorField label="Background Color" value={(config.bgColor as string) ?? ""} disabled={isLocked}
          onChange={(v) => updateConfig("bgColor", v || undefined)} />
        <ColorField label="Title Color" value={(config.titleColor as string) ?? ""} disabled={isLocked}
          onChange={(v) => updateConfig("titleColor", v || undefined)} />
        <ColorField label="Body Text Color" value={(config.textColor as string) ?? ""} disabled={isLocked}
          onChange={(v) => updateConfig("textColor", v || undefined)} />
      </Section>

      {/* Behavior */}
      <Section label="Behavior">
        <NumField label="Priority Weight" value={tile.priority_weight} min={0} max={100} onChange={(v) => onUpdate("priority_weight", v)} disabled={isLocked} />
        <div className="flex items-center gap-3 py-1">
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={tile.is_emergency_slot} disabled={isLocked}
              onChange={(e) => onUpdate("is_emergency_slot", e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500/50" />
            Emergency slot
          </label>
        </div>
        {tile.is_emergency_slot && (
          <p className="text-[10px] text-red-400/70 bg-red-900/10 rounded-md px-2 py-1.5 border border-red-500/10">
            This tile will pulse and show a red indicator bar on the display.
          </p>
        )}
      </Section>

      {/* Advanced */}
      <Section label="Advanced Config" defaultOpen={false}>
        <p className="text-[10px] text-zinc-600 mb-1">Raw JSON configuration for power users.</p>
        <textarea value={tile.config_json ?? ""} disabled={isLocked}
          onChange={(e) => onUpdate("config_json", e.target.value || null)}
          placeholder="{}" rows={5}
          className={inputCls + " font-mono text-xs"} />
      </Section>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Carousel Slide Editor (inline in inspector)
// ---------------------------------------------------------------------------

function CarouselEditor({ config, updateConfig, disabled }: {
  config: Record<string, unknown>
  updateConfig: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const slides = parseSlides(config.carouselSlides as string)
  const [addMode, setAddMode] = useState<"upload" | "library" | "url">("upload")
  const [newUrl, setNewUrl] = useState("")
  const [newCaption, setNewCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [library, setLibrary] = useState<{ id: number; url: string; kind: string; mime_type: string; filename: string }[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function setSlides(next: CarouselSlide[]) {
    updateConfig("carouselSlides", next.length > 0 ? stringifySlides(next) : undefined)
  }

  function detectType(url: string): CarouselSlide["type"] {
    if (/youtu\.?be/i.test(url)) return "youtube"
    if (/\.pdf(\?|$)/i.test(url)) return "pdf"
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return "video"
    return "image"
  }

  function addSlideFromUrl(url: string, caption?: string) {
    const type = detectType(url)
    setSlides([...slides, { type, url, caption: caption || undefined }])
  }

  function addUrlSlide() {
    const url = newUrl.trim()
    if (!url) return
    addSlideFromUrl(url, newCaption.trim())
    setNewUrl("")
    setNewCaption("")
  }

  // Upload from desktop
  async function handleUpload(file: File) {
    setError(null)
    const isImage = file.type.startsWith("image/")
    const isPdf = file.type === "application/pdf"
    const isVideo = file.type.startsWith("video/")
    if (!isImage && !isPdf && !isVideo) {
      setError("Supported: images, PDFs, videos")
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File too large (max 50 MB)")
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/media", { method: "POST", body: form })
      if (!res.ok) { setError("Upload failed"); return }
      const data = await res.json()
      const url = data.url || `/api/media/${data.id}`
      const type: CarouselSlide["type"] = isPdf ? "pdf" : isVideo ? "video" : "image"
      setSlides([...slides, { type, url, caption: file.name }])
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

  // Library
  async function loadLibrary() {
    setLoadingLib(true)
    try {
      const res = await fetch("/api/media")
      if (res.ok) setLibrary(await res.json())
    } catch { /* ignore */ }
    finally { setLoadingLib(false) }
  }

  useEffect(() => {
    if (addMode === "library") loadLibrary()
  }, [addMode])

  function addFromLibrary(item: typeof library[number]) {
    const url = item.url || `/api/media/${item.id}`
    const type: CarouselSlide["type"] = item.mime_type?.startsWith("video/") ? "video"
      : item.mime_type === "application/pdf" ? "pdf" : "image"
    setSlides([...slides, { type, url, caption: item.filename }])
  }

  function removeSlide(i: number) {
    setSlides(slides.filter((_, idx) => idx !== i))
  }

  function moveSlide(from: number, dir: -1 | 1) {
    const to = from + dir
    if (to < 0 || to >= slides.length) return
    const next = [...slides]
    ;[next[from], next[to]] = [next[to], next[from]]
    setSlides(next)
  }

  function updateSlideCaption(i: number, caption: string) {
    const next = [...slides]
    next[i] = { ...next[i], caption: caption || undefined }
    setSlides(next)
  }

  const typeIcons: Record<string, string> = { image: "🖼️", pdf: "📄", youtube: "▶️", video: "🎬" }

  return (
    <>
      <div className="flex items-center gap-2 rounded-md bg-orange-900/10 border border-orange-500/15 px-2.5 py-2 mb-1">
        <span className="text-base">🎠</span>
        <span className="text-[11px] text-orange-400 font-medium">Carousel Slides</span>
        <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">{slides.length} slide{slides.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Existing slides */}
      {slides.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {slides.map((slide, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50 p-2">
              {/* Thumbnail preview */}
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                {slide.type === "image" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={slide.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm">{typeIcons[slide.type] ?? "?"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-zinc-300 truncate" title={slide.url}>{slide.caption || slide.url}</p>
                <input
                  value={slide.caption ?? ""}
                  onChange={(e) => updateSlideCaption(i, e.target.value)}
                  placeholder="Caption (optional)"
                  disabled={disabled}
                  className="mt-1 w-full rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none border border-zinc-700/50 focus:border-orange-500/30"
                />
                <span className="text-[8px] text-zinc-600 uppercase">{slide.type}</span>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveSlide(i, -1)} disabled={i === 0 || disabled}
                  className="rounded px-1 text-[9px] text-zinc-500 hover:bg-zinc-700 disabled:opacity-20">▲</button>
                <button onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1 || disabled}
                  className="rounded px-1 text-[9px] text-zinc-500 hover:bg-zinc-700 disabled:opacity-20">▼</button>
                <button onClick={() => removeSlide(i)} disabled={disabled}
                  className="rounded px-1 text-[9px] text-red-400 hover:bg-red-900/20 disabled:opacity-30">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add slide area */}
      <div className="rounded-md border border-dashed border-zinc-700 p-2 space-y-2">
        <p className="text-[10px] text-zinc-500 font-medium">Add Slides</p>

        {/* Source tabs */}
        <div className="flex rounded-lg bg-zinc-800/50 p-0.5">
          {([
            { key: "upload" as const, label: "Upload" },
            { key: "library" as const, label: "Library" },
            { key: "url" as const, label: "URL / YouTube" },
          ]).map((t) => (
            <button key={t.key} onClick={() => setAddMode(t.key)} disabled={disabled}
              className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                addMode === t.key ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              } disabled:opacity-50`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Upload tab */}
        {addMode === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 transition-colors ${
              dragOver ? "border-orange-400 bg-orange-500/10" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-orange-400" />
                <span className="text-xs text-zinc-400">Uploading...</span>
              </div>
            ) : (
              <>
                <svg className="h-6 w-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-[11px] text-zinc-400">Drop files here or click to browse</span>
                <span className="text-[9px] text-zinc-600">Images, PDFs, Videos &middot; Max 50 MB each</span>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*,video/*,.pdf" multiple className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Library tab */}
        {addMode === "library" && (
          <div>
            {loadingLib ? (
              <div className="py-3 text-center text-xs text-zinc-500">Loading library...</div>
            ) : library.length === 0 ? (
              <div className="py-3 text-center text-xs text-zinc-600">
                No media uploaded yet.
                <button onClick={() => setAddMode("upload")} className="ml-1 text-orange-400 hover:underline">Upload files</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {library.map((m) => {
                  const isImage = m.mime_type?.startsWith("image/")
                  const isPdf = m.mime_type === "application/pdf"
                  const isVideo = m.mime_type?.startsWith("video/")
                  const alreadyAdded = slides.some((s) => s.url === m.url || s.url === `/api/media/${m.id}`)
                  return (
                    <button key={m.id} onClick={() => addFromLibrary(m)} disabled={disabled || alreadyAdded}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                        alreadyAdded ? "border-orange-400/50 opacity-50" : "border-zinc-700 hover:border-orange-400/50"
                      } disabled:cursor-not-allowed`}>
                      {isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.url || `/api/media/${m.id}`} alt={m.filename} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center bg-zinc-800 gap-0.5">
                          <span className="text-lg">{isPdf ? "📄" : isVideo ? "🎬" : "📁"}</span>
                          <span className="text-[7px] text-zinc-500 truncate max-w-full px-1">{m.filename}</span>
                        </div>
                      )}
                      {alreadyAdded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="rounded bg-orange-500 px-1 py-0.5 text-[7px] font-bold text-white">ADDED</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => loadLibrary()} disabled={loadingLib}
              className="mt-1 text-[10px] text-zinc-600 hover:text-zinc-400 disabled:opacity-30">Refresh</button>
          </div>
        )}

        {/* URL tab */}
        {addMode === "url" && (
          <div className="space-y-1.5">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Image URL, YouTube link, PDF URL, or video URL"
              disabled={disabled}
              className="w-full rounded-md bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 outline-none border border-zinc-700 focus:border-orange-500/30"
            />
            {newUrl && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span>{typeIcons[detectType(newUrl)]}</span>
                <span>Detected: <strong className="text-zinc-400">{detectType(newUrl)}</strong></span>
              </div>
            )}
            <input
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="Caption (optional)"
              disabled={disabled}
              className="w-full rounded-md bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 outline-none border border-zinc-700 focus:border-orange-500/30"
            />
            <button onClick={addUrlSlide} disabled={!newUrl.trim() || disabled}
              className="rounded-md bg-orange-600/80 px-3 py-1 text-[11px] font-medium text-white hover:bg-orange-500 disabled:opacity-30">
              + Add Slide
            </button>
          </div>
        )}

        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>

      {/* Carousel settings */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mt-2">Carousel Options</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500">Interval (sec)</span>
          <input type="number" value={(config.carouselInterval as number) ?? 5} min={1} max={120} disabled={disabled}
            onChange={(e) => updateConfig("carouselInterval", parseInt(e.target.value) || undefined)}
            className="w-full rounded-md bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700 tabular-nums" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500">Transition</span>
          <select value={(config.carouselTransition as string) ?? "fade"} disabled={disabled}
            onChange={(e) => updateConfig("carouselTransition", e.target.value)}
            className="w-full rounded-md bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700">
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
      <div className="space-y-1.5 py-1">
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselAutoplay !== "false" && config.carouselAutoplay !== false}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselAutoplay", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Autoplay
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselShowDots !== "false" && config.carouselShowDots !== false}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselShowDots", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Show dots
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselShowArrows === "true" || config.carouselShowArrows === true}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselShowArrows", e.target.checked ? "true" : undefined)}
            className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Show arrows
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselShowProgress !== "false" && config.carouselShowProgress !== false}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselShowProgress", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Show progress bar
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselKenBurns === "true" || config.carouselKenBurns === true}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselKenBurns", e.target.checked ? "true" : undefined)}
            className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Ken-Burns zoom (images only)
        </label>
      </div>
      <label className="flex flex-col gap-1 mt-1">
        <span className="text-[10px] text-zinc-500">Image Fit</span>
        <select value={(config.carouselFit as string) ?? "cover"} disabled={disabled}
          onChange={(e) => updateConfig("carouselFit", e.target.value)}
          className="w-full rounded-md bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 outline-none border border-zinc-700">
          <option value="cover">Cover (fill, may crop)</option>
          <option value="contain">Contain (letterbox)</option>
          <option value="fill">Fill (stretch to size)</option>
        </select>
      </label>
    </>
  )
}


// ---------------------------------------------------------------------------
// PDF / Document Editor
// ---------------------------------------------------------------------------

function PdfEditor({ config, updateConfig, disabled }: {
  config: Record<string, unknown>
  updateConfig: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = (config.pdfUrl as string) ?? ""

  async function uploadPdf(file: File) {
    setError(null)
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/media", { method: "POST", body: fd })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      updateConfig("pdfUrl", data.url)
    } catch (e) {
      setError("Upload failed")
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {url ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-rose-400 truncate">{url.split("/").pop()}</p>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-zinc-500 hover:text-zinc-300">Open in new tab &nearr;</a>
            </div>
            <button onClick={() => updateConfig("pdfUrl", undefined)} disabled={disabled}
              className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30">Remove</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-zinc-700 hover:border-rose-500/40 px-3 py-6 text-center"
        >
          <span className="text-2xl">📄</span>
          <p className="mt-1 text-xs text-zinc-400">{uploading ? "Uploading…" : "Click to upload PDF"}</p>
          <p className="text-[10px] text-zinc-600">Max 100 MB</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="application/pdf" hidden disabled={disabled || uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = "" }} />

      <Field label="Or paste a URL">
        <input value={url} disabled={disabled}
          onChange={(e) => updateConfig("pdfUrl", e.target.value || undefined)}
          placeholder="https://example.com/file.pdf" className={inputCls} />
      </Field>

      {error && (
        <p className="rounded-md bg-red-900/20 border border-red-500/20 px-2 py-1 text-[11px] text-red-400">{error}</p>
      )}

      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mt-1">Display Options</p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Start Page">
          <input type="number" min={1} value={(config.pdfPage as number) ?? 1} disabled={disabled}
            onChange={(e) => updateConfig("pdfPage", parseInt(e.target.value, 10) || 1)}
            className={inputCls + " tabular-nums"} />
        </Field>
        <Field label="Total Pages (optional)">
          <input type="number" min={0} value={(config.pdfTotalPages as number) ?? 0} disabled={disabled}
            onChange={(e) => updateConfig("pdfTotalPages", parseInt(e.target.value, 10) || undefined)}
            placeholder="auto" className={inputCls + " tabular-nums"} />
        </Field>
      </div>

      <Field label="Auto-Advance Pages (sec, 0 = off)">
        <input type="number" min={0} max={120} value={(config.pdfAutoAdvanceSec as number) ?? 0} disabled={disabled}
          onChange={(e) => updateConfig("pdfAutoAdvanceSec", parseInt(e.target.value, 10) || undefined)}
          className={inputCls + " tabular-nums"} />
      </Field>

      <Field label="Fit Mode">
        <select value={(config.pdfFit as string) ?? "page"} disabled={disabled}
          onChange={(e) => updateConfig("pdfFit", e.target.value)} className={selectCls}>
          <option value="page">Fit page</option>
          <option value="width">Fit width</option>
          <option value="height">Fit height</option>
        </select>
      </Field>

      <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer py-1">
        <input type="checkbox" disabled={disabled}
          checked={config.pdfShowChrome !== "false" && config.pdfShowChrome !== false}
          onChange={(e) => updateConfig("pdfShowChrome", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-600 bg-zinc-800 text-rose-500 focus:ring-rose-500/50" />
        Show page indicator overlay
      </label>

      <p className="text-[10px] text-zinc-600">
        Auto-advance only works when total pages is set. PDF is rendered using the browser&rsquo;s built-in viewer.
      </p>
    </>
  )
}
