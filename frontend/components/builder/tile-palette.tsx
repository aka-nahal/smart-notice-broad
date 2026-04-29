"use client"

import { useState } from "react"

const TILE_CATEGORIES = [
  {
    label: "Content",
    tiles: [
      { value: "notice", label: "Notice", icon: "📋", desc: "Text notice with title and body", defaultW: 2, defaultH: 2 },
      { value: "banner", label: "Banner", icon: "📢", desc: "Large header with gradient", defaultW: 6, defaultH: 2 },
      { value: "ticker", label: "Ticker", icon: "📜", desc: "Scrolling marquee text", defaultW: 12, defaultH: 1 },
      { value: "emergency", label: "Emergency", icon: "🚨", desc: "High-priority alert slot", defaultW: 2, defaultH: 2 },
    ],
  },
  {
    label: "Media",
    tiles: [
      { value: "image", label: "Image", icon: "🖼️", desc: "Photo or graphic from library", defaultW: 2, defaultH: 2 },
      { value: "video", label: "Video", icon: "🎬", desc: "Looping video with autoplay", defaultW: 4, defaultH: 3 },
      { value: "carousel", label: "Carousel", icon: "🎠", desc: "Sliding images, PDFs, or YouTube", defaultW: 4, defaultH: 3 },
      { value: "pdf", label: "Document", icon: "📄", desc: "PDF document, page-by-page viewer", defaultW: 4, defaultH: 4 },
    ],
  },
  {
    label: "Widgets",
    tiles: [
      { value: "clock",          label: "Clock",          icon: "🕐", desc: "Live time and date display",        defaultW: 2, defaultH: 2 },
      { value: "weather",        label: "Weather",        icon: "🌤️", desc: "Live weather from OpenWeather",     defaultW: 3, defaultH: 2 },
      { value: "sensor",         label: "Sensor",         icon: "📡", desc: "RPi GPIO sensor readings",           defaultW: 2, defaultH: 2 },
      { value: "timetable",      label: "Timetable",      icon: "📅", desc: "Today's class schedule tracker",    defaultW: 3, defaultH: 4 },
      { value: "teacher_status", label: "Teacher Status", icon: "👤", desc: "Current class or fallback to cabin", defaultW: 3, defaultH: 2 },
      { value: "teachers_list",  label: "Teachers List",  icon: "👥", desc: "All teachers · auto-scrolls when full", defaultW: 3, defaultH: 5 },
      { value: "stack",          label: "Stack",          icon: "🗂️", desc: "Cycle multiple widgets in one slot",  defaultW: 3, defaultH: 3 },
    ],
  },
] as const

export type PaletteTile = typeof TILE_CATEGORIES[number]["tiles"][number]

interface Props {
  disabled: boolean
  onAddTile: (type: string) => void
  onStartDrag: (type: string, w: number, h: number) => void
}

export function TilePalette({ disabled, onAddTile, onStartDrag }: Props) {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [search, setSearch] = useState("")

  const filteredCategories = TILE_CATEGORIES.map((cat) => ({
    ...cat,
    tiles: cat.tiles.filter((t) =>
      !search || t.label.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.tiles.length > 0)

  return (
    <aside className="flex w-52 flex-shrink-0 flex-col border-r border-zinc-800 overflow-y-auto">
      {/* Search */}
      <div className="p-2.5 border-b border-zinc-800/50">
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tiles..."
            className="w-full rounded-md bg-zinc-800/50 pl-7 pr-2 py-1.5 text-xs text-zinc-300 outline-none border border-zinc-700/50 focus:border-blue-500/40 placeholder:text-zinc-600"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-zinc-600 hover:text-zinc-400">&times;</button>
          )}
        </div>
      </div>

      {/* Tile categories */}
      <div className="flex-1 p-2.5 space-y-3">
        {filteredCategories.map((cat) => (
          <div key={cat.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{cat.label}</p>
            <div className="space-y-0.5">
              {cat.tiles.map((tt) => (
                <button
                  key={tt.value}
                  onClick={() => onAddTile(tt.value)}
                  onMouseDown={(e) => {
                    if (e.button === 0 && !disabled) {
                      e.preventDefault()
                      onStartDrag(tt.value, tt.defaultW, tt.defaultH)
                    }
                  }}
                  disabled={disabled}
                  className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-zinc-800/80 disabled:opacity-50 border border-transparent hover:border-zinc-700 cursor-grab active:cursor-grabbing"
                >
                  <span className="text-sm mt-0.5 group-hover:scale-110 transition-transform">{tt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-zinc-300 group-hover:text-zinc-100">{tt.label}</span>
                      <span className="text-[8px] text-zinc-700 tabular-nums bg-zinc-800/50 rounded px-1">{tt.defaultW}×{tt.defaultH}</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 group-hover:text-zinc-500 leading-tight">{tt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="text-center py-6 text-xs text-zinc-600">
            <p>No tiles match &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Shortcuts (collapsible) */}
      <div className="border-t border-zinc-800">
        <button
          onClick={() => setShowShortcuts((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
        >
          Keyboard Shortcuts
          <span className={`transition-transform text-[8px] ${showShortcuts ? "rotate-180" : ""}`}>▼</span>
        </button>
        {showShortcuts && (
          <div className="px-3 pb-3">
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-zinc-600">
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Ctrl+Z/Y</kbd><span>Undo / Redo</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Ctrl+D</kbd><span>Duplicate</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Ctrl+L</kbd><span>Lock / Unlock</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Ctrl+A</kbd><span>Select all</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Shift+Click</kbd><span>Multi-select</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">↑↓←→</kbd><span>Nudge tile</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">G</kbd><span>Toggle grid</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Del</kbd><span>Delete</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Esc</kbd><span>Cancel action</span>
              <kbd className="rounded bg-zinc-800 px-1 text-center text-zinc-500">Ctrl+Scroll</kbd><span>Zoom</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
