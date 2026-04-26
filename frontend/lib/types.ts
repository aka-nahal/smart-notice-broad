// ---------------------------------------------------------------------------
// Unified type definitions for Smart Notice Board
// ---------------------------------------------------------------------------

// ---- Notice ----

export interface NoticeRead {
  id: number
  title: string
  body: string
  summary: string | null
  category: string | null
  tags: string[]
  priority: number
  locale: string
  created_at: string
  updated_at: string
  ai_metadata_json: string | null
}

export interface NoticeCreate {
  title: string
  body: string
  summary?: string
  category?: string
  tags?: string[]
  priority?: number
  locale?: string
}

export interface NoticeUpdate {
  title?: string
  body?: string
  summary?: string | null
  category?: string | null
  tags?: string[]
  priority?: number
}

// ---- Tile ----

export interface TileRead {
  id: number
  layout_version_id: number
  tile_type: string
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  z_index: number
  priority_weight: number
  refresh_interval_sec: number | null
  animation_style: string | null
  config_json: string | null
  is_emergency_slot: boolean
  notice_id: number | null
  media_id: number | null
}

export interface TileCreate {
  tile_type: string
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  z_index?: number
  notice_id?: number | null
  media_id?: number | null
  config_json?: string | null
  is_emergency_slot?: boolean
}

export interface TileUpdate {
  tile_type?: string
  grid_x?: number
  grid_y?: number
  grid_w?: number
  grid_h?: number
  z_index?: number
  priority_weight?: number
  notice_id?: number | null
  media_id?: number | null
  config_json?: string | null
  is_emergency_slot?: boolean
}

export interface TileBulkUpdateItem {
  id: number
  tile_type?: string
  grid_x?: number
  grid_y?: number
  grid_w?: number
  grid_h?: number
  z_index?: number
  priority_weight?: number
  notice_id?: number | null
  config_json?: string | null
  is_emergency_slot?: boolean
}

// ---- Layout ----

export interface LayoutVersionRead {
  id: number
  layout_id: number
  version: number
  grid_cols: number
  grid_rows: number
  gap_px: number
  is_published: boolean
  published_at: string | null
  meta_json: string | null
  tiles: TileRead[]
}

export interface LayoutRead {
  id: number
  name: string
  description: string | null
  is_template: boolean
  versions: LayoutVersionRead[]
}

export interface LayoutCreate {
  name: string
  description?: string
  grid_cols?: number
  grid_rows?: number
  gap_px?: number
}

export interface LayoutUpdate {
  name?: string
  description?: string
}

// ---- Display ----

export interface TileConfig {
  fontFamily?: string
  titleSize?: number
  bodySize?: number
  bgColor?: string
  textColor?: string
  tickerText?: string
  bannerTitle?: string
  bannerSubtitle?: string
  /** Banner title font size (px). If omitted, auto-sizes to the tile. */
  bannerTitleSize?: number
  /** Banner subtitle font size (px). If omitted, auto-sizes to the tile. */
  bannerSubtitleSize?: number
  imageUrl?: string
  imageAlt?: string
  videoUrl?: string
  videoPoster?: string
  videoAutoplay?: boolean | string
  videoLoop?: boolean | string
  videoControls?: boolean | string
  clockTimezone?: string
  clockFormat?: "12h" | "24h"
  weatherCity?: string
  weatherUnits?: "metric" | "imperial"
  weatherShowForecast?: boolean | string
  // Carousel
  carouselSlides?: string // JSON array of slides: [{ type, url, caption? }]
  carouselInterval?: number // seconds between slides
  carouselTransition?: "fade" | "slide" | "none"
  carouselShowDots?: boolean | string
  carouselShowArrows?: boolean | string
  carouselAutoplay?: boolean | string
  carouselShowProgress?: boolean | string
  carouselKenBurns?: boolean | string
  carouselFit?: "cover" | "contain" | "fill" | string
}

export interface DisplayTileDTO {
  tile: TileRead
  notice: NoticeRead | null
  media_url: string | null
  effective_priority: number
  is_visible_by_schedule: boolean
}

export interface DisplayBundle {
  layout_version_id: number
  grid_cols: number
  grid_rows: number
  gap_px: number
  mode: string
  focus_tile_id: number | null
  tiles: DisplayTileDTO[]
  server_time_utc: string
}

// ---- Teacher ----

export type TeacherStatus = "available" | "busy" | "in_class" | "on_leave" | "unavailable"

export interface TeacherRead {
  id: number
  name: string
  department: string
  subject: string | null
  email: string | null
  phone: string | null
  room: string | null
  status: TeacherStatus
  status_note: string | null
  schedule_json: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TeacherCreate {
  name: string
  department?: string
  subject?: string
  email?: string
  phone?: string
  room?: string
  status?: TeacherStatus
  status_note?: string
  schedule_json?: string
  avatar_url?: string
}

export interface TeacherUpdate {
  name?: string
  department?: string
  subject?: string | null
  email?: string | null
  phone?: string | null
  room?: string | null
  status?: TeacherStatus
  status_note?: string | null
  schedule_json?: string | null
  avatar_url?: string | null
  is_active?: boolean
}

export const TEACHER_STATUSES: { value: TeacherStatus; label: string; color: string; icon: string }[] = [
  { value: "available", label: "Available", color: "emerald", icon: "✅" },
  { value: "busy", label: "Busy", color: "amber", icon: "⏳" },
  { value: "in_class", label: "In Class", color: "blue", icon: "📚" },
  { value: "on_leave", label: "On Leave", color: "violet", icon: "🏖️" },
  { value: "unavailable", label: "Unavailable", color: "red", icon: "❌" },
]

// ---- Media ----

export interface MediaAsset {
  id: number
  url: string
  kind: string
  mime_type: string
  bytes_size: number
  filename: string
  created_at: string
}

// ---- Builder-specific ----

export type InteractionMode =
  | { kind: "idle" }
  | { kind: "moving" }
  | { kind: "dragging"; tileId: number; offsetCol: number; offsetRow: number }
  | { kind: "resizing"; handle: string }
  | { kind: "drag-resize"; tileId: number; handle: string }
  | { kind: "palette-drop"; tileType: string; w: number; h: number }

export interface ContextMenuState {
  x: number
  y: number
  tileId: number | null
  cell: { col: number; row: number }
}

// ---- Constants ----

export const TILE_TYPES = [
  { value: "notice", label: "Notice", icon: "📋" },
  { value: "clock", label: "Clock", icon: "🕐" },
  { value: "banner", label: "Banner", icon: "📢" },
  { value: "ticker", label: "Ticker", icon: "📜" },
  { value: "image", label: "Image", icon: "🖼️" },
  { value: "video", label: "Video", icon: "🎬" },
  { value: "weather", label: "Weather", icon: "🌤️" },
  { value: "carousel", label: "Carousel", icon: "🎠" },
  { value: "pdf", label: "Document", icon: "📄" },
  { value: "emergency", label: "Emergency", icon: "🚨" },
] as const

export const TILE_COLORS: Record<string, string> = {
  notice: "border-blue-500/50 bg-blue-500/10",
  clock: "border-violet-500/50 bg-violet-500/10",
  ticker: "border-amber-500/50 bg-amber-500/10",
  banner: "border-sky-500/50 bg-sky-500/10",
  image: "border-emerald-500/50 bg-emerald-500/10",
  video: "border-pink-500/50 bg-pink-500/10",
  emergency: "border-red-500/50 bg-red-500/10",
  weather: "border-teal-500/50 bg-teal-500/10",
  carousel: "border-orange-500/50 bg-orange-500/10",
  pdf: "border-rose-500/50 bg-rose-500/10",
}

export const TILE_COLORS_SELECTED: Record<string, string> = {
  notice: "border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/50",
  clock: "border-violet-400 bg-violet-500/20 ring-1 ring-violet-400/50",
  ticker: "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400/50",
  banner: "border-sky-400 bg-sky-500/20 ring-1 ring-sky-400/50",
  image: "border-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-400/50",
  video: "border-pink-400 bg-pink-500/20 ring-1 ring-pink-400/50",
  emergency: "border-red-400 bg-red-500/20 ring-1 ring-red-400/50",
  weather: "border-teal-400 bg-teal-500/20 ring-1 ring-teal-400/50",
  carousel: "border-orange-400 bg-orange-500/20 ring-1 ring-orange-400/50",
  pdf: "border-rose-400 bg-rose-500/20 ring-1 ring-rose-400/50",
}
