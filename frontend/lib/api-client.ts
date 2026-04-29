// ---------------------------------------------------------------------------
// Centralized API client for Smart Notice Board
// ---------------------------------------------------------------------------

import type {
  LayoutRead,
  LayoutCreate,
  LayoutUpdate,
  LayoutVersionRead,
  TileRead,
  TileCreate,
  TileUpdate,
  TileBulkUpdateItem,
  NoticeRead,
  NoticeCreate,
  NoticeUpdate,
  MediaAsset,
  DisplayBundle,
  TeacherRead,
  TeacherCreate,
  TeacherUpdate,
  PeriodRead,
  PeriodCreate,
  PeriodUpdate,
  ScheduleSlotRead,
  ScheduleSlotUpsert,
} from "./types"

// ---- Base fetch wrapper ----

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ---- Layouts ----

export const layouts = {
  list: () => request<LayoutRead[]>("/api/layouts"),

  get: (id: number) => request<LayoutRead>(`/api/layouts/${id}`),

  create: (data: LayoutCreate) =>
    request<LayoutRead>("/api/layouts", {
      method: "POST",
      body: JSON.stringify({ name: data.name, description: data.description, grid_cols: data.grid_cols ?? 12, grid_rows: data.grid_rows ?? 8, gap_px: data.gap_px ?? 8 }),
    }),

  update: (id: number, data: LayoutUpdate) =>
    request<LayoutRead>(`/api/layouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/api/layouts/${id}`, { method: "DELETE" }),
}

// ---- Versions ----

export const versions = {
  update: (layoutId: number, versionId: number, data: { grid_cols?: number; grid_rows?: number; gap_px?: number }) =>
    request<LayoutVersionRead>(`/api/layouts/${layoutId}/versions/${versionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  publish: (layoutId: number, versionId: number) =>
    request<void>(`/api/layouts/${layoutId}/versions/${versionId}/publish`, { method: "POST" }),

  clone: (layoutId: number, sourceVersionId: number) =>
    request<LayoutVersionRead>(`/api/layouts/${layoutId}/versions`, {
      method: "POST",
      body: JSON.stringify({ source_version_id: sourceVersionId }),
    }),
}

// ---- Tiles ----

function tileBase(layoutId: number, versionId: number) {
  return `/api/layouts/${layoutId}/versions/${versionId}/tiles`
}

export const tiles = {
  create: (layoutId: number, versionId: number, data: TileCreate) =>
    request<TileRead>(tileBase(layoutId, versionId), {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (layoutId: number, versionId: number, tileId: number, data: TileUpdate) =>
    request<TileRead>(`${tileBase(layoutId, versionId)}/${tileId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (layoutId: number, versionId: number, tileId: number) =>
    request<void>(`${tileBase(layoutId, versionId)}/${tileId}`, { method: "DELETE" }),

  bulkUpdate: (layoutId: number, versionId: number, items: TileBulkUpdateItem[]) =>
    request<TileRead[]>(`${tileBase(layoutId, versionId)}/bulk`, {
      method: "POST",
      body: JSON.stringify({ tiles: items }),
    }),
}

// ---- Notices ----

export const notices = {
  list: () => request<NoticeRead[]>("/api/notices"),

  get: (id: number) => request<NoticeRead>(`/api/notices/${id}`),

  create: (data: NoticeCreate) =>
    request<NoticeRead>("/api/notices", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: NoticeUpdate) =>
    request<NoticeRead>(`/api/notices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/api/notices/${id}`, { method: "DELETE" }),
}

// ---- Media ----

export const media = {
  list: () => request<MediaAsset[]>("/api/media"),

  upload: async (file: File): Promise<MediaAsset & { duplicate: boolean }> => {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/media", { method: "POST", body: form })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || "Upload failed")
    }
    return res.json()
  },

  delete: (id: number) =>
    request<void>(`/api/media/${id}`, { method: "DELETE" }),

  url: (id: number) => `/api/media/${id}`,
}

// ---- Display ----

export const display = {
  bundle: () => request<DisplayBundle>("/api/display/bundle"),
}

// ---- Teachers ----

export const teachers = {
  list: () => request<TeacherRead[]>("/api/teachers"),

  get: (id: number) => request<TeacherRead>(`/api/teachers/${id}`),

  create: (data: TeacherCreate) =>
    request<TeacherRead>("/api/teachers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: TeacherUpdate) =>
    request<TeacherRead>(`/api/teachers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: number, status: string, statusNote?: string) =>
    request<TeacherRead>(`/api/teachers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, status_note: statusNote }),
    }),

  delete: (id: number) =>
    request<void>(`/api/teachers/${id}`, { method: "DELETE" }),

  // Schedule grid
  schedule: (id: number) =>
    request<ScheduleSlotRead[]>(`/api/teachers/${id}/schedule`),

  upsertSlot: (id: number, slot: ScheduleSlotUpsert) =>
    request<ScheduleSlotRead | null>(`/api/teachers/${id}/schedule`, {
      method: "PUT",
      body: JSON.stringify(slot),
    }),

  deleteSlot: (id: number, slotId: number) =>
    request<void>(`/api/teachers/${id}/schedule/${slotId}`, { method: "DELETE" }),
}

// ---- Periods ----

export const periods = {
  list: () => request<PeriodRead[]>("/api/periods"),

  create: (data: PeriodCreate) =>
    request<PeriodRead>("/api/periods", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: PeriodUpdate) =>
    request<PeriodRead>(`/api/periods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/api/periods/${id}`, { method: "DELETE" }),
}

// ---- App settings (generic key/value, JSON values) ----

export const appSettings = {
  get: <T = unknown>(key: string) =>
    request<{ key: string; value: T | null }>(`/api/settings/${encodeURIComponent(key)}`),

  put: <T = unknown>(key: string, value: T) =>
    request<{ key: string; value: T }>(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
}

// ---- Convenience re-export ----

const api = { layouts, versions, tiles, notices, media, display, teachers, periods, appSettings }
export default api
