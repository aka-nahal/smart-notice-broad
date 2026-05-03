"use client"

import type { LayoutRead, LayoutVersionRead } from "@/lib/types"
import { SaveIndicator } from "./save-indicator"

function ToolbarBtn({ children, onClick, disabled, active, title, danger }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; title?: string; danger?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-30 ${
        active ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
        : danger ? "text-red-400 hover:bg-red-900/20 border border-transparent"
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}>
      {children}
    </button>
  )
}

function ToolbarSep() {
  return <div className="h-5 w-px bg-zinc-100 dark:bg-zinc-800 mx-0.5" />
}

interface Props {
  layouts: LayoutRead[]
  activeLayout: LayoutRead
  version: LayoutVersionRead
  saving: boolean
  lastSaved: Date | null
  saveError: string | null
  canUndo: boolean
  canRedo: boolean
  showGrid: boolean
  showGridSettings: boolean
  onSwitchLayout: (id: number) => void
  onSwitchVersion: (id: number) => void
  onUndo: () => void
  onRedo: () => void
  onToggleGrid: () => void
  onToggleSettings: () => void
  onCloneVersion: () => void
  onPublish: () => void
}

export function BuilderToolbar({
  layouts, activeLayout, version,
  saving, lastSaved, saveError,
  canUndo, canRedo,
  showGrid, showGridSettings,
  onSwitchLayout, onSwitchVersion,
  onUndo, onRedo,
  onToggleGrid, onToggleSettings,
  onCloneVersion, onPublish,
}: Props) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <a href="/admin" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors" title="Back to Admin">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>

        <ToolbarSep />

        {/* Layout selector */}
        {layouts.length > 1 ? (
          <select
            value={activeLayout.id}
            onChange={(e) => onSwitchLayout(Number(e.target.value))}
            className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
          >
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{activeLayout.name}</span>
        )}

        {/* Version selector */}
        <select
          value={version.id}
          onChange={(e) => onSwitchVersion(Number(e.target.value))}
          className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 outline-none border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          {activeLayout.versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version} &middot; {v.grid_cols}&times;{v.grid_rows}{v.is_published ? " (live)" : ""}
            </option>
          ))}
        </select>

        {version.is_published && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}

        <ToolbarSep />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <ToolbarBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
            </svg>
          </ToolbarBtn>
          <ToolbarBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
            </svg>
          </ToolbarBtn>
        </div>

        <SaveIndicator saving={saving} lastSaved={lastSaved} error={saveError} />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {/* View controls */}
        <ToolbarBtn onClick={onToggleGrid} active={showGrid} title="Toggle grid overlay (G)">
          <svg className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
          Grid
        </ToolbarBtn>

        <ToolbarBtn onClick={onToggleSettings} active={showGridSettings} title="Grid & resolution settings">
          <svg className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </ToolbarBtn>

        <ToolbarSep />

        {/* Version controls */}
        <ToolbarBtn onClick={onCloneVersion} disabled={saving} title="Clone this version as a new draft">
          + Version
        </ToolbarBtn>

        <a href="/" target="_blank" className="rounded-md border border-transparent px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
          Preview &nearr;
        </a>

        {/* Publish */}
        <button onClick={onPublish} disabled={saving}
          className={`rounded-lg px-4 py-1.5 text-xs font-medium text-zinc-900 dark:text-white transition-all disabled:opacity-50 ${
            version.is_published
              ? "bg-emerald-700 hover:bg-emerald-600"
              : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
          }`}>
          {version.is_published ? "Republish" : "Publish"}
        </button>
      </div>
    </header>
  )
}
