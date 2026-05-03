"use client"

function AlignIcon({ d }: { d: string }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d={d} />
    </svg>
  )
}

function ToolBtn({ children, onClick, disabled, title, active }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; active?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`flex items-center justify-center rounded-md h-7 w-7 transition-colors disabled:opacity-30 ${
        active ? "bg-blue-500/15 text-blue-400" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200"
      }`}>
      {children}
    </button>
  )
}

interface Props {
  count: number
  onAlignLeft: () => void
  onAlignRight: () => void
  onAlignTop: () => void
  onAlignBottom: () => void
  onDistributeH: () => void
  onDistributeV: () => void
}

export function AlignToolbar({ count, onAlignLeft, onAlignRight, onAlignTop, onAlignBottom, onDistributeH, onDistributeV }: Props) {
  if (count < 2) return null

  return (
    <div className="flex items-center gap-0.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30 px-4 py-1">
      <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Align</span>

      <ToolBtn onClick={onAlignLeft} title="Align left edges">
        <AlignIcon d="M2 1v14M5 4h8M5 8h6M5 12h10" />
      </ToolBtn>
      <ToolBtn onClick={onAlignRight} title="Align right edges">
        <AlignIcon d="M14 1v14M3 4h8M5 8h6M1 12h10" />
      </ToolBtn>
      <ToolBtn onClick={onAlignTop} title="Align top edges">
        <AlignIcon d="M1 2h14M4 5v8M8 5v6M12 5v10" />
      </ToolBtn>
      <ToolBtn onClick={onAlignBottom} title="Align bottom edges">
        <AlignIcon d="M1 14h14M4 3v8M8 5v6M12 1v10" />
      </ToolBtn>

      <div className="mx-1.5 h-4 w-px bg-zinc-100 dark:bg-zinc-800" />

      <span className="mr-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Distribute</span>

      <ToolBtn onClick={onDistributeH} disabled={count < 3} title="Distribute horizontally (3+ tiles)">
        <AlignIcon d="M1 3v10M5 5v6M11 5v6M15 3v10" />
      </ToolBtn>
      <ToolBtn onClick={onDistributeV} disabled={count < 3} title="Distribute vertically (3+ tiles)">
        <AlignIcon d="M3 1h10M5 5h6M5 11h6M3 15h10" />
      </ToolBtn>

      <div className="mx-1.5 h-4 w-px bg-zinc-100 dark:bg-zinc-800" />

      <span className="text-[10px] text-zinc-600 tabular-nums">{count} selected</span>
    </div>
  )
}
