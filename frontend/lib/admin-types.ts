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
  config_json: string | null
  is_emergency_slot: boolean
  notice_id: number | null
  media_id: number | null
}

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

export interface TileCreate {
  tile_type: string
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  z_index?: number
  notice_id?: number | null
  config_json?: string | null
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

export const TILE_TYPES = [
  { value: "notice", label: "Notice", icon: "📋" },
  { value: "clock", label: "Clock", icon: "🕐" },
  { value: "banner", label: "Banner", icon: "📢" },
  { value: "ticker", label: "Ticker", icon: "📜" },
  { value: "image", label: "Image", icon: "🖼️" },
  { value: "emergency", label: "Emergency", icon: "🚨" },
] as const

export const TILE_COLORS: Record<string, string> = {
  notice: "border-blue-500/50 bg-blue-500/10",
  clock: "border-violet-500/50 bg-violet-500/10",
  ticker: "border-amber-500/50 bg-amber-500/10",
  banner: "border-sky-500/50 bg-sky-500/10",
  image: "border-emerald-500/50 bg-emerald-500/10",
  emergency: "border-red-500/50 bg-red-500/10",
  weather: "border-teal-500/50 bg-teal-500/10",
}

export const TILE_COLORS_SELECTED: Record<string, string> = {
  notice: "border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/50",
  clock: "border-violet-400 bg-violet-500/20 ring-1 ring-violet-400/50",
  ticker: "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400/50",
  banner: "border-sky-400 bg-sky-500/20 ring-1 ring-sky-400/50",
  image: "border-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-400/50",
  emergency: "border-red-400 bg-red-500/20 ring-1 ring-red-400/50",
  weather: "border-teal-400 bg-teal-500/20 ring-1 ring-teal-400/50",
}
