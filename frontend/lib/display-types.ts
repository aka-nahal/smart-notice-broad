export interface NoticeDTO {
  id: number;
  title: string;
  body: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  priority: number;
  locale: string;
  created_at: string;
  updated_at: string;
  ai_metadata_json: string | null;
}

export interface TileConfig {
  theme?: "light" | "dark" | "auto"
  zoom?: number
  fontFamily?: string
  titleSize?: number
  bodySize?: number
  bgColor?: string
  textColor?: string
  tickerText?: string
  bannerTitle?: string
  bannerSubtitle?: string
  imageUrl?: string
  imageAlt?: string
  clockStyle?: "digital" | "analog" | "minimal" | "flip" | "word"
  clockFormat?: "12h" | "24h"
  clockShowSeconds?: boolean | string
  clockShowDate?: boolean | string
  clockTimezone?: string
  clockDateFormat?: "short" | "long" | "iso"
}

export interface TileDTO {
  id: number;
  layout_version_id: number;
  tile_type: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  z_index: number;
  priority_weight: number;
  config_json: string | null;
  is_emergency_slot: boolean;
  notice_id: number | null;
  media_id: number | null;
}

export interface DisplayTileDTO {
  tile: TileDTO;
  notice: NoticeDTO | null;
  media_url: string | null;
  effective_priority: number;
  is_visible_by_schedule: boolean;
}

export interface DisplayBundle {
  layout_version_id: number;
  grid_cols: number;
  grid_rows: number;
  gap_px: number;
  mode: string;
  focus_tile_id: number | null;
  tiles: DisplayTileDTO[];
  server_time_utc: string;
}
