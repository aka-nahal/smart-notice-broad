"use client"

import { useEffect, useRef } from "react"

export interface ContextMenuItem {
  label: string
  icon?: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  onClick: () => void
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const menuW = 220
  const menuH = items.reduce((h, item) => h + (item.separator ? 9 : 32), 8)
  const clampedX = Math.min(x, window.innerWidth - menuW - 8)
  const clampedY = Math.min(y, window.innerHeight - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-[200px] rounded-xl border border-zinc-300/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 py-1 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 mx-2 border-t border-zinc-200/80 dark:border-zinc-800/80" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose() }}
            className={`group flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors disabled:opacity-30 ${
              item.danger
                ? "text-red-400 hover:bg-red-500/10"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80"
            }`}
          >
            {item.icon && (
              <span className="w-4 text-center text-xs opacity-60 group-hover:opacity-100">{item.icon}</span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <kbd className="ml-2 rounded bg-zinc-100/80 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-500 font-mono">{item.shortcut}</kbd>
            )}
          </button>
        ),
      )}
    </div>
  )
}
