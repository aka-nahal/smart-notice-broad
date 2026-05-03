"use client"

import { useEffect, useRef, useState } from "react"
import type { TileRead, TileUpdate, NoticeRead } from "@/lib/types"
import { TILE_TYPES } from "@/lib/types"
import type { GridSpec } from "@/lib/grid-engine"
import { ImageUpload } from "./image-upload"
import { VideoUpload, isYouTubeUrl } from "./video-upload"
import { parseSlides, stringifySlides, type CarouselSlide } from "@/components/carousel-widget"
import { parseStackChildren, stringifyStackChildren, type StackChild } from "@/components/stack-widget"

const inputCls = "w-full rounded-md px-2 py-1.5 text-sm outline-none disabled:opacity-50 border bg-zinc-50 text-zinc-900 border-zinc-300 dark:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-800 dark:text-zinc-200 dark:border-zinc-300 dark:border-zinc-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50"
const selectCls = inputCls

function Section({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer items-center gap-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 select-none">
        <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {label}
      </summary>
      <div className="ml-1 space-y-2 pb-2">{children}</div>
    </details>
  )
}

// Plain wrapper without accordion chrome — used inside tabs where the tab
// label already communicates what the panel is for.
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2.5 ${className}`}>{children}</div>
}

// Icon-only action button used in the inspector header row.
function IconBtn({ children, onClick, disabled = false, title, className = "" }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  title: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 flex-1 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 disabled:opacity-30 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

const Ico = ({ d }: { d: string }) => (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)
const MoveIcon = () => <Ico d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
const CopyIcon = () => <Ico d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
const LockIcon = () => <Ico d="M12 11v4m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
const UnlockIcon = () => <Ico d="M12 11v4M6 19h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0" />
const TrashIcon = () => <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />

// Subhead inside a tab when a panel has multiple logical groups.
function PanelHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
      {children}
    </p>
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
          className="h-7 w-7 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700 bg-transparent disabled:opacity-50" />
        <input value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className={inputCls + " font-mono text-xs flex-1"} />
        {value && (
          <button onClick={() => onChange("")} disabled={disabled}
            className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30">&times;</button>
        )}
      </div>
    </Field>
  )
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ---------------------------------------------------------------------------
// Inspector tabs
// ---------------------------------------------------------------------------
type TabKey = "content" | "style" | "layout" | "more"

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "content", label: "Content", icon: "✎" },
  { key: "style",   label: "Style",   icon: "✦" },
  { key: "layout",  label: "Layout",  icon: "⛶" },
  { key: "more",    label: "More",    icon: "⋯" },
]

function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-0.5 mb-2">
      {TABS.map((t) => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span className="text-xs">{t.icon}</span>{t.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-type Quick Style presets — one click to apply a curated bundle
// ---------------------------------------------------------------------------
type Preset = { label: string; values: Record<string, string | number | undefined> }
const QUICK_PRESETS: Record<string, Preset[]> = {
  notice: [
    { label: "Compact",  values: { noticeTitleSize: 14, noticeBodySize: 11, padding: 8,  textAlign: undefined } },
    { label: "Standard", values: { noticeTitleSize: undefined, noticeBodySize: undefined, padding: undefined } },
    { label: "Headline", values: { noticeTitleSize: 36, noticeBodySize: 18, padding: 24, titleWeight: "bold" } },
    { label: "Hero",     values: { noticeTitleSize: 64, noticeBodySize: 24, padding: 32, titleWeight: "extrabold", textAlign: "center", verticalAlign: "center" } },
  ],
  emergency: [
    { label: "Standard", values: { noticeTitleSize: 28, noticeBodySize: 16, padding: 20, titleWeight: "bold" } },
    { label: "Big Alert",values: { noticeTitleSize: 56, noticeBodySize: 22, padding: 32, titleWeight: "extrabold", textAlign: "center" } },
  ],
  banner: [
    { label: "Subtle",   values: { bannerTitleSize: 24, bannerSubtitleSize: 14 } },
    { label: "Standard", values: { bannerTitleSize: undefined, bannerSubtitleSize: undefined } },
    { label: "Hero",     values: { bannerTitleSize: 64, bannerSubtitleSize: 24 } },
    { label: "Mega",     values: { bannerTitleSize: 128, bannerSubtitleSize: 40 } },
  ],
  ticker: [
    { label: "Subtle",   values: { tickerTextSize: 14, tickerSpeed: 30 } },
    { label: "Standard", values: { tickerTextSize: undefined, tickerSpeed: undefined } },
    { label: "Bold",     values: { tickerTextSize: 28, tickerSpeed: 18 } },
    { label: "Slow",     values: { tickerSpeed: 60 } },
    { label: "Fast",     values: { tickerSpeed: 10 } },
  ],
  clock: [
    { label: "Big Time",   values: { clockStyle: undefined, clockShowSeconds: undefined, clockShowDate: undefined, clockFormat: undefined } },
    { label: "Wall",       values: { clockStyle: "analog", clockShowSeconds: undefined, clockShowDate: undefined } },
    { label: "Minimal",    values: { clockStyle: "minimal", clockShowSeconds: "false", clockShowDate: "false" } },
    { label: "12-hour",    values: { clockFormat: "12h" } },
    { label: "Word Clock", values: { clockStyle: "word", clockShowSeconds: "false" } },
    { label: "Flip",       values: { clockStyle: "flip" } },
  ],
  weather: [
    { label: "Tile",     values: { weatherTempSize: undefined, weatherCitySize: undefined, weatherShowForecast: "false" } },
    { label: "Big Temp", values: { weatherTempSize: 96, weatherCitySize: 18 } },
    { label: "Forecast", values: { weatherTempSize: undefined, weatherShowForecast: undefined } },
  ],
  carousel: [
    { label: "Fade",     values: { carouselTransition: undefined, carouselInterval: undefined } },
    { label: "Slide",    values: { carouselTransition: "slide" } },
    { label: "Slow",     values: { carouselInterval: 10 } },
    { label: "Fast",     values: { carouselInterval: 3 } },
  ],
  stack: [
    { label: "Standard", values: { stackInterval: undefined, stackTransition: undefined } },
    { label: "Slow",     values: { stackInterval: 12 } },
    { label: "Fast",     values: { stackInterval: 4 } },
    { label: "Fade",     values: { stackTransition: undefined } },
    { label: "Slide",    values: { stackTransition: "slide" } },
  ],
}

function PresetRow({ presets, onApply, disabled }: {
  presets: Preset[]
  onApply: (p: Preset["values"]) => void
  disabled: boolean
}) {
  if (!presets.length) return null
  return (
    <div className="mb-2 rounded-md bg-blue-50 dark:bg-blue-500/5 border border-blue-200/60 dark:border-blue-500/15 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1.5">Quick Style</p>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p.label} type="button" disabled={disabled}
            onClick={() => onApply(p.values)}
            className="rounded-md border border-blue-200 dark:border-blue-500/20 bg-white dark:bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/40 disabled:opacity-50 transition-colors">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
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
  const [activeTab, setActiveTab] = useState<TabKey>("content")

  const type = tile.tile_type

  function applyPreset(preset: Record<string, string | number | undefined>) {
    const c = { ...config }
    for (const [k, v] of Object.entries(preset)) {
      if (v === undefined) delete c[k]
      else c[k] = v as string | number
    }
    onUpdate("config_json", Object.keys(c).length > 0 ? JSON.stringify(c) : null)
  }

  const presets = QUICK_PRESETS[type] ?? []

  const typeInfo = TILE_TYPES.find((t) => t.value === type)

  return (
    <div className="flex flex-col gap-1">
      {/* Header — icon, tile id, size, lock badge, quick action icons */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/15 to-indigo-500/10 text-base border border-blue-500/15">
          {typeInfo?.icon ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">{typeInfo?.label ?? type}</p>
          <p className="text-[10px] text-zinc-500 tabular-nums">#{tile.id} &middot; {tile.grid_w}&times;{tile.grid_h} @ ({tile.grid_x},{tile.grid_y})</p>
        </div>
        {isLocked && (
          <span title="Locked" className="text-[11px] text-amber-500" aria-label="locked">🔒</span>
        )}
      </div>

      {/* Quick actions — icon buttons with tooltips */}
      <div className="flex gap-1 mb-2">
        <IconBtn onClick={onMove} disabled={isLocked} title="Click to place"
          className="text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/40">
          <MoveIcon />
        </IconBtn>
        <IconBtn onClick={onDuplicate} title="Duplicate (Ctrl+D)"
          className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500">
          <CopyIcon />
        </IconBtn>
        <IconBtn onClick={onToggleLock} title={isLocked ? "Unlock" : "Lock (Ctrl+L)"}
          className="text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40">
          {isLocked ? <UnlockIcon /> : <LockIcon />}
        </IconBtn>
        <IconBtn onClick={onDelete} disabled={isLocked} title="Delete (Del)"
          className="text-red-500 hover:bg-red-500/10 hover:border-red-500/40">
          <TrashIcon />
        </IconBtn>
      </div>

      {/* Type selector */}
      <Field label="Tile Type">
        <select value={type} onChange={(e) => onUpdate("tile_type", e.target.value)} disabled={isLocked} className={selectCls}>
          {TILE_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.icon} {tt.label}</option>)}
        </select>
      </Field>

      {/* Tab navigation */}
      <div className="mt-2">
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Quick Style presets — visible on Content & Style tabs */}
      {(activeTab === "content" || activeTab === "style") && (
        <PresetRow presets={presets} onApply={applyPreset} disabled={isLocked} />
      )}

      {/* Display: theme + zoom — applies to every tile type */}
      {activeTab === "style" && (
      <Panel>
        <PanelHead>Display</PanelHead>
        <Field label="Theme">
          <div className="grid grid-cols-3 gap-1">
            {(["auto", "light", "dark"] as const).map((t) => {
              const current = (config.theme as string) ?? "auto"
              const active = current === t
              return (
                <button key={t} type="button" disabled={isLocked}
                  onClick={() => updateConfig("theme", t === "auto" ? undefined : t)}
                  className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}>
                  {t === "auto" ? "Auto" : t === "light" ? "☀ Light" : "☾ Dark"}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label={`Zoom (${typeof config.zoom === "number" ? config.zoom.toFixed(2) : "1.00"}×)`}>
          <input
            type="range" min={0.5} max={3} step={0.05}
            value={typeof config.zoom === "number" ? config.zoom : 1}
            disabled={isLocked}
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) updateConfig("zoom", n === 1 ? undefined : Math.round(n * 100) / 100)
            }}
            className="w-full accent-blue-500"
          />
        </Field>
        <div className="flex flex-wrap gap-1">
          {[1, 1.25, 1.5, 2, 2.5, 3].map((z) => (
            <button key={z} type="button" disabled={isLocked}
              onClick={() => updateConfig("zoom", z === 1 ? undefined : z)}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-white disabled:opacity-50">
              {z}×
            </button>
          ))}
        </div>
      </Panel>
      )}

      {/* Content section */}
      {activeTab === "content" && (
      <Panel>
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
                className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 px-2 py-2 text-xs text-zinc-500 hover:border-blue-500/30 hover:text-blue-400 disabled:opacity-30 transition-colors">
                + Create new notice inline
              </button>
            ) : (
              <div className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50 p-2.5 space-y-2">
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
                    className="rounded-md px-3 py-1 text-[10px] text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">Cancel</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Field label="Title size (px)">
                <input
                  type="number" min={10} max={256}
                  value={typeof config.noticeTitleSize === "number" ? config.noticeTitleSize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("noticeTitleSize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("noticeTitleSize", Math.max(10, Math.min(256, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
              <Field label="Body size (px)">
                <input
                  type="number" min={8} max={128}
                  value={typeof config.noticeBodySize === "number" ? config.noticeBodySize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("noticeBodySize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("noticeBodySize", Math.max(8, Math.min(128, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1">
              {[14, 18, 24, 32, 48, 64].map((px) => (
                <button key={px} type="button" disabled={isLocked}
                  onClick={() => updateConfig("noticeTitleSize", px)}
                  className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 hover:border-blue-500/50 disabled:opacity-50">
                  {px}px
                </button>
              ))}
              <button type="button" disabled={isLocked}
                onClick={() => { updateConfig("noticeTitleSize", undefined); updateConfig("noticeBodySize", undefined) }}
                className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 hover:border-amber-500/50 disabled:opacity-50">
                Auto
              </button>
            </div>
          </>
        )}

        {type === "ticker" && (
          <>
            <Field label="Ticker Text">
              <textarea value={(config.tickerText as string) ?? ""} disabled={isLocked}
                onChange={(e) => updateConfig("tickerText", e.target.value)}
                placeholder="Welcome to the Smart Notice Board..." rows={3}
                className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Text size (px)">
                <input
                  type="number" min={10} max={128}
                  value={typeof config.tickerTextSize === "number" ? config.tickerTextSize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("tickerTextSize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("tickerTextSize", Math.max(10, Math.min(128, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
              <Field label="Speed (sec/loop)">
                <input
                  type="number" min={3} max={120}
                  value={typeof config.tickerSpeed === "number" ? config.tickerSpeed : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("tickerSpeed", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("tickerSpeed", Math.max(3, Math.min(120, n)))
                  }}
                  placeholder="20"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
            </div>
          </>
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
            <div className="grid grid-cols-2 gap-2">
              <Field label="Title size (px)">
                <input
                  type="number" min={10} max={256}
                  value={typeof config.bannerTitleSize === "number" ? config.bannerTitleSize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("bannerTitleSize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("bannerTitleSize", Math.max(10, Math.min(256, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
              <Field label="Subtitle size (px)">
                <input
                  type="number" min={8} max={128}
                  value={typeof config.bannerSubtitleSize === "number" ? config.bannerSubtitleSize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("bannerSubtitleSize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("bannerSubtitleSize", Math.max(8, Math.min(128, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1">
              {[16, 24, 32, 48, 64, 96].map((px) => (
                <button
                  key={px}
                  type="button"
                  disabled={isLocked}
                  onClick={() => updateConfig("bannerTitleSize", px)}
                  className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300 hover:border-blue-500/50 hover:text-white disabled:opacity-50"
                >
                  {px}px
                </button>
              ))}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => { updateConfig("bannerTitleSize", undefined); updateConfig("bannerSubtitleSize", undefined) }}
                className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50"
              >
                Auto
              </button>
            </div>
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

            <div className="rounded-md bg-zinc-100/40 dark:bg-zinc-800/40 border border-zinc-300/50 dark:border-zinc-700/50 p-2 text-[10px] text-zinc-500">
              Display videos always autoplay (muted) and loop, with no controls.
            </div>
          </>
        )}

        {type === "clock" && (
          <ClockEditor config={config} updateConfig={updateConfig} disabled={isLocked} />
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
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer py-1">
              <input type="checkbox"
                checked={config.weatherShowForecast !== "false" && config.weatherShowForecast !== false}
                disabled={isLocked}
                onChange={(e) => updateConfig("weatherShowForecast", e.target.checked ? undefined : "false")}
                className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-teal-500 focus:ring-teal-500/50" />
              Show 3-hour forecast
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Temp size (px)">
                <input
                  type="number" min={16} max={256}
                  value={typeof config.weatherTempSize === "number" ? config.weatherTempSize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("weatherTempSize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("weatherTempSize", Math.max(16, Math.min(256, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
              <Field label="City size (px)">
                <input
                  type="number" min={8} max={64}
                  value={typeof config.weatherCitySize === "number" ? config.weatherCitySize : ""}
                  disabled={isLocked}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") { updateConfig("weatherCitySize", undefined); return }
                    const n = parseInt(raw, 10)
                    if (!isNaN(n)) updateConfig("weatherCitySize", Math.max(8, Math.min(64, n)))
                  }}
                  placeholder="auto"
                  className={inputCls + " tabular-nums"}
                />
              </Field>
            </div>
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

        {type === "teacher_status" && (
          <TeacherStatusEditor config={config} updateConfig={updateConfig} disabled={isLocked} />
        )}

        {type === "teachers_list" && (
          <TeachersListEditor config={config} updateConfig={updateConfig} disabled={isLocked} />
        )}

        {type === "stack" && (
          <StackEditor config={config} updateConfig={updateConfig} disabled={isLocked} />
        )}
      </Panel>
      )}

      {/* Position & Size */}
      {activeTab === "layout" && (
      <Panel>
        <PanelHead>Position & Size</PanelHead>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="X" value={tile.grid_x} min={0} max={spec.cols - tile.grid_w} onChange={(v) => onUpdate("grid_x", v)} disabled={isLocked} />
          <NumField label="Y" value={tile.grid_y} min={0} max={spec.rows - tile.grid_h} onChange={(v) => onUpdate("grid_y", v)} disabled={isLocked} />
          <NumField label="Width" value={tile.grid_w} min={1} max={spec.cols - tile.grid_x} onChange={(v) => onUpdate("grid_w", v)} disabled={isLocked} />
          <NumField label="Height" value={tile.grid_h} min={1} max={spec.rows - tile.grid_y} onChange={(v) => onUpdate("grid_h", v)} disabled={isLocked} />
        </div>
        <NumField label="Z-Index (layer order)" value={tile.z_index} min={0} max={99} onChange={(v) => onUpdate("z_index", v)} disabled={isLocked} />
      </Panel>
      )}

      {/* Styling */}
      {activeTab === "style" && (
      <Panel>
        <PanelHead>Typography &amp; Colors</PanelHead>
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
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
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
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
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
      </Panel>
      )}

      {/* Behavior */}
      {activeTab === "more" && (
      <Panel>
        <PanelHead>Behavior</PanelHead>
        <NumField label="Priority Weight" value={tile.priority_weight} min={0} max={100} onChange={(v) => onUpdate("priority_weight", v)} disabled={isLocked} />
        <div className="flex items-center gap-3 py-1">
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={tile.is_emergency_slot} disabled={isLocked}
              onChange={(e) => onUpdate("is_emergency_slot", e.target.checked)}
              className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-red-500 focus:ring-red-500/50" />
            Emergency slot
          </label>
        </div>
        {tile.is_emergency_slot && (
          <p className="text-[10px] text-red-400/70 bg-red-900/10 rounded-md px-2 py-1.5 border border-red-500/10">
            This tile will pulse and show a red indicator bar on the display.
          </p>
        )}
      </Panel>
      )}

      {/* Advanced */}
      {activeTab === "more" && (
      <Section label="Advanced JSON" defaultOpen={false}>
        <p className="text-[10px] text-zinc-600 mb-1">Raw JSON configuration for power users.</p>
        <textarea value={tile.config_json ?? ""} disabled={isLocked}
          onChange={(e) => onUpdate("config_json", e.target.value || null)}
          placeholder="{}" rows={5}
          className={inputCls + " font-mono text-xs"} />
      </Section>
      )}
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
            <div key={i} className="flex items-start gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50 p-2">
              {/* Thumbnail preview */}
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                {slide.type === "image" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={slide.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm">{typeIcons[slide.type] ?? "?"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-zinc-700 dark:text-zinc-300 truncate" title={slide.url}>{slide.caption || slide.url}</p>
                <input
                  value={slide.caption ?? ""}
                  onChange={(e) => updateSlideCaption(i, e.target.value)}
                  placeholder="Caption (optional)"
                  disabled={disabled}
                  className="mt-1 w-full rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 outline-none border border-zinc-300/50 dark:border-zinc-700/50 focus:border-orange-500/30"
                />
                <span className="text-[8px] text-zinc-600 uppercase">{slide.type}</span>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveSlide(i, -1)} disabled={i === 0 || disabled}
                  className="rounded px-1 text-[9px] text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20">▲</button>
                <button onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1 || disabled}
                  className="rounded px-1 text-[9px] text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20">▼</button>
                <button onClick={() => removeSlide(i)} disabled={disabled}
                  className="rounded px-1 text-[9px] text-red-400 hover:bg-red-900/20 disabled:opacity-30">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add slide area */}
      <div className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 p-2 space-y-2">
        <p className="text-[10px] text-zinc-500 font-medium">Add Slides</p>

        {/* Source tabs */}
        <div className="flex rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 p-0.5">
          {([
            { key: "upload" as const, label: "Upload" },
            { key: "library" as const, label: "Library" },
            { key: "url" as const, label: "URL / YouTube" },
          ]).map((t) => (
            <button key={t.key} onClick={() => setAddMode(t.key)} disabled={disabled}
              className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                addMode === t.key ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
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
              dragOver ? "border-orange-400 bg-orange-500/10" : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/30"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 dark:border-zinc-600 border-t-orange-400" />
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Uploading...</span>
              </div>
            ) : (
              <>
                <svg className="h-6 w-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Drop files here or click to browse</span>
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
                        alreadyAdded ? "border-orange-400/50 opacity-50" : "border-zinc-300 dark:border-zinc-700 hover:border-orange-400/50"
                      } disabled:cursor-not-allowed`}>
                      {isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.url || `/api/media/${m.id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                          <span className="text-2xl">{isPdf ? "📄" : isVideo ? "🎬" : "📁"}</span>
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
              className="mt-1 text-[10px] text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-600 dark:hover:text-zinc-400 disabled:opacity-30">Refresh</button>
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
              className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-orange-500/30"
            />
            {newUrl && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span>{typeIcons[detectType(newUrl)]}</span>
                <span>Detected: <strong className="text-zinc-600 dark:text-zinc-400">{detectType(newUrl)}</strong></span>
              </div>
            )}
            <input
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="Caption (optional)"
              disabled={disabled}
              className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-orange-500/30"
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
            className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 tabular-nums" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500">Transition</span>
          <select value={(config.carouselTransition as string) ?? "fade"} disabled={disabled}
            onChange={(e) => updateConfig("carouselTransition", e.target.value)}
            className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700">
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
      <div className="space-y-1.5 py-1">
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselAutoplay !== "false" && config.carouselAutoplay !== false}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselAutoplay", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Autoplay
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselShowDots !== "false" && config.carouselShowDots !== false}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselShowDots", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Show dots
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselShowArrows === "true" || config.carouselShowArrows === true}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselShowArrows", e.target.checked ? "true" : undefined)}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Show arrows
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselShowProgress !== "false" && config.carouselShowProgress !== false}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselShowProgress", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Show progress bar
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input type="checkbox"
            checked={config.carouselKenBurns === "true" || config.carouselKenBurns === true}
            disabled={disabled}
            onChange={(e) => updateConfig("carouselKenBurns", e.target.checked ? "true" : undefined)}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-orange-500 focus:ring-orange-500/50" />
          Ken-Burns zoom (images only)
        </label>
      </div>
      <label className="flex flex-col gap-1 mt-1">
        <span className="text-[10px] text-zinc-500">Image Fit</span>
        <select value={(config.carouselFit as string) ?? "cover"} disabled={disabled}
          onChange={(e) => updateConfig("carouselFit", e.target.value)}
          className="w-full rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700">
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
                className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Open in new tab &nearr;</a>
            </div>
            <button onClick={() => updateConfig("pdfUrl", undefined)} disabled={disabled}
              className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30">Remove</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-rose-500/40 px-3 py-6 text-center"
        >
          <span className="text-2xl">📄</span>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{uploading ? "Uploading…" : "Click to upload PDF"}</p>
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

      <Field label="Fit Mode (size to tile)">
        <div className="grid grid-cols-3 gap-1">
          {(["page", "width", "height"] as const).map((m) => {
            const active = ((config.pdfFit as string) ?? "page") === m
            return (
              <button key={m} type="button" disabled={disabled}
                onClick={() => updateConfig("pdfFit", m === "page" ? undefined : m)}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}>
                {m === "page" ? "Page" : m === "width" ? "Width" : "Height"}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Loop direction (auto-advance)">
        <div className="grid grid-cols-2 gap-1">
          {(["forward", "pingpong"] as const).map((m) => {
            const active = ((config.pdfLoop as string) ?? "forward") === m
            return (
              <button key={m} type="button" disabled={disabled}
                onClick={() => updateConfig("pdfLoop", m === "forward" ? undefined : m)}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}>
                {m === "forward" ? "1 → N → 1" : "1 → N → 1 (ping-pong)"}
              </button>
            )
          })}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer py-1">
        <input type="checkbox" disabled={disabled}
          checked={config.pdfShowChrome !== "false" && config.pdfShowChrome !== false}
          onChange={(e) => updateConfig("pdfShowChrome", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-rose-500 focus:ring-rose-500/50" />
        Show page indicator overlay
      </label>

      <p className="text-[10px] text-zinc-600">
        Auto-advance only works when total pages is set. Pages cross-fade as they switch.
      </p>
    </>
  )
}


// ---------------------------------------------------------------------------
// Teacher Status Editor
// ---------------------------------------------------------------------------

interface TeacherOpt { id: number; name: string; room: string | null }
interface TimetableOpt { id: number; name: string }

function TeacherStatusEditor({ config, updateConfig, disabled }: {
  config: Record<string, unknown>
  updateConfig: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const [teachers, setTeachers] = useState<TeacherOpt[]>([])
  const [timetables, setTimetables] = useState<TimetableOpt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [tRes, ttRes] = await Promise.all([
          fetch("/api/teachers"),
          fetch("/api/timetables"),
        ])
        const [tData, ttData] = await Promise.all([tRes.json(), ttRes.json()])
        if (cancelled) return
        setTeachers(Array.isArray(tData) ? tData : [])
        setTimetables(Array.isArray(ttData) ? ttData : [])
      } catch {
        // ignore — selectors will show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const teacherId = config.teacherId !== undefined ? String(config.teacherId) : ""
  const timetableId = config.timetableId !== undefined ? String(config.timetableId) : ""
  const selected = teachers.find((t) => String(t.id) === teacherId)

  return (
    <>
      <div className="flex items-center gap-2 rounded-md bg-indigo-900/10 border border-indigo-500/15 px-2.5 py-2 mb-1">
        <span className="text-base">👤</span>
        <span className="text-[11px] text-indigo-400 font-medium">
          Shows current class · falls back to cabin
        </span>
      </div>

      <Field label="Teacher">
        <select
          value={teacherId}
          disabled={disabled || loading}
          onChange={(e) => updateConfig("teacherId", e.target.value ? Number(e.target.value) : undefined)}
          className={selectCls}
        >
          <option value="">{loading ? "Loading…" : "— Select a teacher —"}</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.room ? ` · ${t.room}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Restrict to Timetable (optional)">
        <select
          value={timetableId}
          disabled={disabled || loading}
          onChange={(e) => updateConfig("timetableId", e.target.value ? Number(e.target.value) : undefined)}
          className={selectCls}
        >
          <option value="">All timetables</option>
          {timetables.map((tt) => (
            <option key={tt.id} value={tt.id}>{tt.name}</option>
          ))}
        </select>
      </Field>

      {selected && (
        <p className="text-[10px] text-zinc-500">
          Cabin fallback: <span className="text-zinc-700 dark:text-zinc-300">{selected.room || "—"}</span>.
          Matches timetable entries by name (case-insensitive).
        </p>
      )}

      <p className="text-[10px] text-zinc-600">
        Manage teachers in <a href="/admin/teachers" className="text-indigo-400 hover:underline">/admin/teachers</a>{" "}
        and timetables in <a href="/admin/timetables" className="text-indigo-400 hover:underline">/admin/timetables</a>.
      </p>
    </>
  )
}


// ---------------------------------------------------------------------------
// Teachers List Editor — single tile rendering all teachers, auto-scroll
// ---------------------------------------------------------------------------

function TeachersListEditor({ config, updateConfig, disabled }: {
  config: Record<string, unknown>
  updateConfig: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const filter = (config.teachersFilter as string) || "all"
  const speed = typeof config.teachersScrollSpeed === "number" ? config.teachersScrollSpeed : 25
  const showAvatar = config.teachersShowAvatar !== "false" && config.teachersShowAvatar !== false

  return (
    <>
      <div className="flex items-center gap-2 rounded-md bg-indigo-900/10 border border-indigo-500/15 px-2.5 py-2 mb-1">
        <span className="text-base">👥</span>
        <span className="text-[11px] text-indigo-400 font-medium">
          One tile · all teachers · auto-scrolls when content overflows
        </span>
      </div>

      <Field label="Title">
        <input
          value={(config.teachersTitle as string) ?? ""}
          disabled={disabled}
          onChange={(e) => updateConfig("teachersTitle", e.target.value || undefined)}
          placeholder="Teachers"
          className={inputCls}
        />
      </Field>

      <Field label="Show">
        <select
          value={filter}
          disabled={disabled}
          onChange={(e) => updateConfig("teachersFilter", e.target.value === "all" ? undefined : e.target.value)}
          className={selectCls}
        >
          <option value="all">All teachers</option>
          <option value="available">Available right now</option>
          <option value="in_class">Currently in class</option>
          <option value="busy">Marked busy</option>
        </select>
      </Field>

      <Field label="Scroll speed (px / sec, 0 = no auto-scroll)">
        <input
          type="number" min={0} max={400}
          value={speed}
          disabled={disabled}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            if (Number.isNaN(n)) return
            updateConfig("teachersScrollSpeed", n === 25 ? undefined : Math.max(0, Math.min(400, n)))
          }}
          className={inputCls + " tabular-nums"}
        />
      </Field>
      <div className="flex flex-wrap gap-1">
        {[0, 15, 25, 40, 80].map((n) => (
          <button key={n} type="button" disabled={disabled}
            onClick={() => updateConfig("teachersScrollSpeed", n === 25 ? undefined : n)}
            className={`rounded border px-2 py-0.5 text-[10px] ${
              speed === n
                ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
            } disabled:opacity-50`}
          >
            {n === 0 ? "Off" : `${n}px/s`}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer pt-1">
        <input
          type="checkbox" checked={showAvatar} disabled={disabled}
          onChange={(e) => updateConfig("teachersShowAvatar", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50"
        />
        Show avatar / status dot
      </label>

      <p className="text-[10px] text-zinc-600">
        Card layout, time format, and which fields appear come from the
        Display format settings in <a href="/admin/teachers" className="text-indigo-400 hover:underline">/admin/teachers</a>.
      </p>
    </>
  )
}


// ---------------------------------------------------------------------------
// Stack Editor — Apple Widget Stack: cycle multiple inline widgets
// ---------------------------------------------------------------------------

const STACK_CHILD_TYPES: { value: string; label: string; icon: string }[] = [
  // Content
  { value: "notice",         label: "Notice (text)",   icon: "📋" },
  { value: "banner",         label: "Banner",          icon: "📢" },
  { value: "ticker",         label: "Ticker",          icon: "📜" },
  { value: "emergency",      label: "Emergency",       icon: "🚨" },
  // Media
  { value: "image",          label: "Image",           icon: "🖼️" },
  { value: "video",          label: "Video",           icon: "🎬" },
  { value: "carousel",       label: "Carousel",        icon: "🎠" },
  { value: "pdf",            label: "Document (PDF)",  icon: "📄" },
  // Widgets
  { value: "clock",          label: "Clock",           icon: "🕐" },
  { value: "weather",        label: "Weather",         icon: "🌤️" },
  { value: "timetable",      label: "Timetable",       icon: "📅" },
  { value: "teacher_status", label: "Teacher Status",  icon: "👤" },
  { value: "teachers_list",  label: "Teachers List",   icon: "👥" },
]

function StackEditor({ config, updateConfig, disabled }: {
  config: Record<string, unknown>
  updateConfig: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const items = parseStackChildren(config.stackChildren as string)
  const [openIdx, setOpenIdx] = useState<number | null>(items.length > 0 ? 0 : null)
  const [newType, setNewType] = useState<string>("notice")

  function persist(next: StackChild[]) {
    updateConfig("stackChildren", next.length > 0 ? stringifyStackChildren(next) : undefined)
  }

  function addChild() {
    const child: StackChild = {
      type: newType,
      config: {},
      label: STACK_CHILD_TYPES.find((t) => t.value === newType)?.label ?? newType,
      inline_notice: newType === "notice" ? { title: "", body: "" } : null,
    }
    const next = [...items, child]
    persist(next)
    setOpenIdx(next.length - 1)
  }

  function removeChild(i: number) {
    const next = items.filter((_, idx) => idx !== i)
    persist(next)
    if (openIdx === i) setOpenIdx(null)
    else if (openIdx !== null && openIdx > i) setOpenIdx(openIdx - 1)
  }

  function moveChild(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    persist(next)
    if (openIdx === i) setOpenIdx(j)
    else if (openIdx === j) setOpenIdx(i)
  }

  function updateChild(i: number, patch: Partial<StackChild>) {
    const next = items.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    persist(next)
  }

  function updateChildConfig(i: number, key: string, value: unknown) {
    const child = items[i]
    const c = { ...child.config } as Record<string, unknown>
    if (value === undefined || value === "") delete c[key]
    else c[key] = value
    updateChild(i, { config: c as StackChild["config"] })
  }

  const interval = typeof config.stackInterval === "number" ? config.stackInterval : 8
  const transition = (config.stackTransition as string) ?? "slide"
  const showDots = config.stackShowDots !== "false" && config.stackShowDots !== false
  const paused = config.stackPaused === "true" || config.stackPaused === true

  return (
    <>
      <div className="flex items-center gap-2 rounded-md bg-fuchsia-900/10 border border-fuchsia-500/15 px-2.5 py-2 mb-1">
        <span className="text-base">🗂️</span>
        <span className="text-[11px] text-fuchsia-300 font-medium">Widget Stack</span>
        <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">
          {items.length} widget{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stack settings */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Interval (sec)">
          <input
            type="number" min={1} max={600} value={interval} disabled={disabled}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (!isNaN(n)) updateConfig("stackInterval", n === 8 ? undefined : Math.max(1, Math.min(600, n)))
            }}
            className={inputCls + " tabular-nums"}
          />
        </Field>
        <Field label="Transition">
          <select
            value={transition} disabled={disabled}
            onChange={(e) => updateConfig("stackTransition", e.target.value === "slide" ? undefined : e.target.value)}
            className={selectCls}
          >
            <option value="slide">Slide up</option>
            <option value="fade">Fade</option>
            <option value="none">None</option>
          </select>
        </Field>
      </div>
      <div className="space-y-1.5 py-1">
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input
            type="checkbox" checked={showDots} disabled={disabled}
            onChange={(e) => updateConfig("stackShowDots", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-fuchsia-500 focus:ring-fuchsia-500/50"
          />
          Show indicator dots
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input
            type="checkbox" checked={paused} disabled={disabled}
            onChange={(e) => updateConfig("stackPaused", e.target.checked ? "true" : undefined)}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-fuchsia-500 focus:ring-fuchsia-500/50"
          />
          Pause rotation (show only first widget)
        </label>
      </div>

      {/* Children list */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mt-2">
        Widgets in stack
      </p>
      {items.length === 0 ? (
        <p className="text-[10px] text-zinc-600 italic px-1">
          No widgets yet — add one below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((c, i) => {
            const meta = STACK_CHILD_TYPES.find((t) => t.value === c.type)
            const isOpen = openIdx === i
            return (
              <div key={i} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100/40 dark:bg-zinc-800/40 overflow-hidden">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <span className="text-sm">{meta?.icon ?? "⬛"}</span>
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-[11px] text-zinc-800 dark:text-zinc-200 truncate">
                      {c.label || meta?.label || c.type}
                    </p>
                    <p className="text-[9px] text-zinc-500">{c.type}</p>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => moveChild(i, -1)} disabled={i === 0 || disabled}
                      className="rounded px-1 text-[10px] text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20">▲</button>
                    <button onClick={() => moveChild(i, 1)} disabled={i === items.length - 1 || disabled}
                      className="rounded px-1 text-[10px] text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20">▼</button>
                    <button onClick={() => removeChild(i)} disabled={disabled}
                      className="rounded px-1 text-[10px] text-red-400 hover:bg-red-900/20 disabled:opacity-30">✕</button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-zinc-300/50 dark:border-zinc-700/50 p-2 space-y-2 bg-white/30 dark:bg-zinc-900/30">
                    <Field label="Label (inspector only)">
                      <input
                        value={c.label ?? ""} disabled={disabled}
                        onChange={(e) => updateChild(i, { label: e.target.value || undefined })}
                        placeholder={meta?.label ?? c.type}
                        className={inputCls}
                      />
                    </Field>
                    <StackChildBody child={c} index={i}
                      updateChild={updateChild} updateChildConfig={updateChildConfig}
                      disabled={disabled} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add new child */}
      <div className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 p-2 mt-2 space-y-1.5">
        <p className="text-[10px] text-zinc-500 font-medium">Add widget to stack</p>
        <div className="flex gap-1.5">
          <select value={newType} disabled={disabled}
            onChange={(e) => setNewType(e.target.value)}
            className={selectCls + " flex-1"}>
            {STACK_CHILD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>
          <button onClick={addChild} disabled={disabled}
            className="rounded-md bg-fuchsia-600/80 px-3 py-1 text-[11px] font-medium text-white hover:bg-fuchsia-500 disabled:opacity-30">
            + Add
          </button>
        </div>
      </div>

      <p className="text-[10px] text-zinc-600 mt-2">
        Widgets rotate every {interval}s. Each child uses its own settings —
        the parent stack tile&rsquo;s position and size apply to all of them.
      </p>
    </>
  )
}

function StackChildBody({
  child, index, updateChild, updateChildConfig, disabled,
}: {
  child: StackChild
  index: number
  updateChild: (i: number, patch: Partial<StackChild>) => void
  updateChildConfig: (i: number, key: string, value: unknown) => void
  disabled: boolean
}) {
  const cfg = child.config as Record<string, unknown>

  // Wrapper that adapts the StackChild's per-index updater into the
  // (key, value) signature used by the type-specific editors below.
  const proxyUpdate = (key: string, value: string | number | undefined) =>
    updateChildConfig(index, key, value)

  // Notice + Emergency share the same inline-text payload.
  if (child.type === "notice" || child.type === "emergency") {
    const inline = child.inline_notice ?? {}
    function setInline(patch: Partial<NonNullable<StackChild["inline_notice"]>>) {
      updateChild(index, { inline_notice: { ...inline, ...patch } })
    }
    return (
      <>
        {child.type === "emergency" && (
          <p className="text-[10px] text-red-400/80 bg-red-900/10 rounded-md px-2 py-1.5 border border-red-500/15">
            Emergency child renders with red pulse styling on the display.
          </p>
        )}
        <Field label="Title">
          <input
            value={inline.title ?? ""} disabled={disabled}
            onChange={(e) => setInline({ title: e.target.value })}
            placeholder={child.type === "emergency" ? "Alert title" : "Notice title"}
            className={inputCls}
          />
        </Field>
        <Field label="Body">
          <textarea
            value={inline.body ?? ""} disabled={disabled}
            onChange={(e) => setInline({ body: e.target.value })}
            placeholder="Body text" rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Category (optional)">
          <input
            value={inline.category ?? ""} disabled={disabled}
            onChange={(e) => setInline({ category: e.target.value })}
            placeholder={child.type === "emergency" ? "Alert" : "Announcements"}
            className={inputCls}
          />
        </Field>
      </>
    )
  }

  if (child.type === "banner") {
    return (
      <>
        <Field label="Banner Title">
          <input
            value={(cfg.bannerTitle as string) ?? ""} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "bannerTitle", e.target.value || undefined)}
            placeholder="Banner Title" className={inputCls}
          />
        </Field>
        <Field label="Subtitle">
          <input
            value={(cfg.bannerSubtitle as string) ?? ""} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "bannerSubtitle", e.target.value || undefined)}
            placeholder="Subtitle" className={inputCls}
          />
        </Field>
      </>
    )
  }

  if (child.type === "ticker") {
    return (
      <Field label="Ticker Text">
        <textarea
          value={(cfg.tickerText as string) ?? ""} disabled={disabled}
          onChange={(e) => updateChildConfig(index, "tickerText", e.target.value || undefined)}
          placeholder="Scrolling marquee text..." rows={2}
          className={inputCls}
        />
      </Field>
    )
  }

  if (child.type === "clock") {
    return (
      <p className="text-[10px] text-zinc-500 px-1">
        Live clock — no configuration needed.
      </p>
    )
  }

  if (child.type === "weather") {
    const showForecast = cfg.weatherShowForecast !== "false" && cfg.weatherShowForecast !== false
    return (
      <>
        <Field label="City">
          <input
            value={(cfg.weatherCity as string) ?? ""} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "weatherCity", e.target.value || undefined)}
            placeholder="London" className={inputCls}
          />
        </Field>
        <Field label="Units">
          <select
            value={(cfg.weatherUnits as string) ?? "metric"} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "weatherUnits", e.target.value)}
            className={selectCls}
          >
            <option value="metric">Celsius (°C)</option>
            <option value="imperial">Fahrenheit (°F)</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input
            type="checkbox" checked={showForecast} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "weatherShowForecast", e.target.checked ? undefined : "false")}
            className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-teal-500 focus:ring-teal-500/50"
          />
          Show 3-hour forecast
        </label>
      </>
    )
  }

  if (child.type === "image") {
    return (
      <>
        <StackMediaUploadField
          label="Image"
          accept="image/*"
          urlValue={(cfg.imageUrl as string) ?? ""}
          onSetUrl={(url) => updateChildConfig(index, "imageUrl", url || undefined)}
          disabled={disabled}
          hint="Paste an image URL or upload (max 50 MB)."
        />
        <Field label="Alt Text">
          <input
            value={(cfg.imageAlt as string) ?? ""} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "imageAlt", e.target.value || undefined)}
            placeholder="Description of image" className={inputCls}
          />
        </Field>
        <Field label="Fit Mode">
          <select
            value={(cfg.imageFit as string) ?? "cover"} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "imageFit", e.target.value)}
            className={selectCls}
          >
            <option value="cover">Cover (fill, may crop)</option>
            <option value="contain">Contain (letterbox, no crop)</option>
            <option value="fill">Fill (stretch to size)</option>
          </select>
        </Field>
      </>
    )
  }

  if (child.type === "video") {
    return (
      <>
        <StackMediaUploadField
          label="Video"
          accept="video/*"
          urlValue={(cfg.videoUrl as string) ?? ""}
          onSetUrl={(url) => updateChildConfig(index, "videoUrl", url || undefined)}
          disabled={disabled}
          hint="Paste a video / YouTube URL or upload an MP4 (max 50 MB)."
        />
        {(cfg.videoUrl as string) && isYouTubeUrl(cfg.videoUrl as string) && (
          <div className="rounded-md bg-red-900/10 border border-red-500/15 px-2.5 py-1.5 text-[10px] text-red-400">
            YouTube embedded as iframe (autoplay, muted, looped).
          </div>
        )}
        <Field label="Fit Mode">
          <select
            value={(cfg.videoFit as string) ?? "cover"} disabled={disabled}
            onChange={(e) => updateChildConfig(index, "videoFit", e.target.value)}
            className={selectCls}
          >
            <option value="cover">Cover (fill, may crop)</option>
            <option value="contain">Contain (letterbox, no crop)</option>
            <option value="fill">Fill (stretch to size)</option>
          </select>
        </Field>
        <p className="text-[10px] text-zinc-500">
          Display videos always autoplay (muted) and loop.
        </p>
      </>
    )
  }

  if (child.type === "carousel") {
    return <CarouselEditor config={cfg} updateConfig={proxyUpdate} disabled={disabled} />
  }

  if (child.type === "pdf") {
    return <PdfEditor config={cfg} updateConfig={proxyUpdate} disabled={disabled} />
  }

  if (child.type === "timetable") {
    return <StackTimetableEditor config={cfg} update={proxyUpdate} disabled={disabled} />
  }

  if (child.type === "teacher_status") {
    return <TeacherStatusEditor config={cfg} updateConfig={proxyUpdate} disabled={disabled} />
  }

  if (child.type === "teachers_list") {
    return <TeachersListEditor config={cfg} updateConfig={proxyUpdate} disabled={disabled} />
  }

  return (
    <p className="text-[10px] text-zinc-500 px-1">
      No editor for child type &ldquo;{child.type}&rdquo;.
    </p>
  )
}

// ---------------------------------------------------------------------------
// Stack helpers — small URL-or-upload field used by image/video children
// ---------------------------------------------------------------------------

function StackMediaUploadField({
  label, accept, urlValue, onSetUrl, disabled, hint,
}: {
  label: string
  accept: string
  urlValue: string
  onSetUrl: (url: string) => void
  disabled: boolean
  hint?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    if (file.size > 50 * 1024 * 1024) { setError("File too large (max 50 MB)"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/media", { method: "POST", body: fd })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      onSetUrl(data.url || `/api/media/${data.id}`)
    } catch {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Field label={`${label} URL`}>
        <input
          value={urlValue} disabled={disabled}
          onChange={(e) => onSetUrl(e.target.value)}
          placeholder="https://example.com/file"
          className={inputCls}
        />
      </Field>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-fuchsia-500/40 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : `Upload ${label.toLowerCase()}`}
        </button>
        {urlValue && (
          <button
            type="button" disabled={disabled}
            onClick={() => onSetUrl("")}
            className="text-[10px] text-zinc-500 hover:text-red-400 disabled:opacity-30"
          >
            Clear
          </button>
        )}
      </div>
      <input
        ref={fileRef} type="file" accept={accept} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
      />
      {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

// Inline timetable picker for stack children (no extracted editor exists upstream).
function StackTimetableEditor({ config, update, disabled }: {
  config: Record<string, unknown>
  update: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const [timetables, setTimetables] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/timetables")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setTimetables(Array.isArray(d) ? d : []) })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const ttId = config.timetableId !== undefined ? String(config.timetableId) : ""
  const showTeacher = config.timetableShowTeacher !== "false" && config.timetableShowTeacher !== false
  const showRoom = config.timetableShowRoom !== "false" && config.timetableShowRoom !== false

  return (
    <>
      <Field label="Timetable">
        <select
          value={ttId} disabled={disabled || loading}
          onChange={(e) => update("timetableId", e.target.value ? Number(e.target.value) : undefined)}
          className={selectCls}
        >
          <option value="">{loading ? "Loading…" : "— Select timetable —"}</option>
          {timetables.map((tt) => (<option key={tt.id} value={tt.id}>{tt.name}</option>))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
        <input
          type="checkbox" checked={showTeacher} disabled={disabled}
          onChange={(e) => update("timetableShowTeacher", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-blue-500 focus:ring-blue-500/50"
        />
        Show teacher name
      </label>
      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
        <input
          type="checkbox" checked={showRoom} disabled={disabled}
          onChange={(e) => update("timetableShowRoom", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-blue-500 focus:ring-blue-500/50"
        />
        Show room
      </label>
    </>
  )
}

// ---------------------------------------------------------------------------
// Clock editor — full configuration for the clock tile
// ---------------------------------------------------------------------------
function ClockEditor({ config, updateConfig, disabled }: {
  config: Record<string, unknown>
  updateConfig: (key: string, value: string | number | undefined) => void
  disabled: boolean
}) {
  const style = (config.clockStyle as string) ?? "digital"
  const format = (config.clockFormat as string) ?? "24h"
  const showSeconds = config.clockShowSeconds !== "false" && config.clockShowSeconds !== false
  const showDate = config.clockShowDate !== "false" && config.clockShowDate !== false
  const tz = (config.clockTimezone as string) ?? ""
  const dateFmt = (config.clockDateFormat as string) ?? "long"

  const styleOpts: { value: string; label: string; emoji: string }[] = [
    { value: "digital", label: "Digital", emoji: "🕐" },
    { value: "analog", label: "Analog", emoji: "⏱" },
    { value: "minimal", label: "Minimal", emoji: "▢" },
    { value: "flip", label: "Flip", emoji: "⏏" },
    { value: "word", label: "Word", emoji: "✎" },
  ]

  return (
    <>
      <Field label="Clock Style">
        <div className="grid grid-cols-3 gap-1">
          {styleOpts.map((s) => {
            const active = style === s.value
            return (
              <button key={s.value} type="button" disabled={disabled}
                onClick={() => updateConfig("clockStyle", s.value === "digital" ? undefined : s.value)}
                className={`rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
                  active
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/40"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}>
                <span className="mr-1">{s.emoji}</span>{s.label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Format">
        <div className="grid grid-cols-2 gap-1">
          {(["24h", "12h"] as const).map((f) => (
            <button key={f} type="button" disabled={disabled}
              onClick={() => updateConfig("clockFormat", f === "24h" ? undefined : f)}
              className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                format === f
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}>
              {f === "24h" ? "24-hour" : "12-hour"}
            </button>
          ))}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer py-1">
        <input type="checkbox" checked={showSeconds} disabled={disabled}
          onChange={(e) => updateConfig("clockShowSeconds", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-violet-500 focus:ring-violet-500/50" />
        Show seconds
      </label>

      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer py-1">
        <input type="checkbox" checked={showDate} disabled={disabled}
          onChange={(e) => updateConfig("clockShowDate", e.target.checked ? undefined : "false")}
          className="rounded border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-violet-500 focus:ring-violet-500/50" />
        Show date
      </label>

      {showDate && (
        <Field label="Date Format">
          <select value={dateFmt} disabled={disabled}
            onChange={(e) => updateConfig("clockDateFormat", e.target.value === "long" ? undefined : e.target.value)}
            className={inputCls}>
            <option value="long">Long (Monday, January 1, 2026)</option>
            <option value="short">Short (Mon, Jan 1)</option>
            <option value="iso">ISO (2026-01-01)</option>
          </select>
        </Field>
      )}

      <Field label="Timezone (IANA)">
        <input
          value={tz} disabled={disabled}
          onChange={(e) => updateConfig("clockTimezone", e.target.value || undefined)}
          placeholder="e.g. Asia/Kolkata, America/New_York"
          className={inputCls}
        />
      </Field>
      <p className="text-[10px] text-zinc-500">Leave blank to use the device&rsquo;s local timezone.</p>
    </>
  )
}
