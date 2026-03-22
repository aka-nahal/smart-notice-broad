import { rectToGridPlacement } from "@/lib/grid-engine"
import type { DisplayBundle, DisplayTileDTO } from "@/lib/display-types"

async function fetchBundle(): Promise<DisplayBundle> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? ""
  const res = await fetch(`${base}/api/display/bundle`, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`bundle ${res.status}`)
  return res.json()
}

function TileCard({ item }: { item: DisplayTileDTO }) {
  const { tile, notice, is_visible_by_schedule } = item
  const { gridRow, gridColumn } = rectToGridPlacement({
    x: tile.grid_x,
    y: tile.grid_y,
    w: tile.grid_w,
    h: tile.grid_h
  })
  const hidden = !is_visible_by_schedule
  return (
    <article
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/90 p-4 shadow-lg backdrop-blur-sm transition-opacity duration-300 ${
        hidden ? "opacity-20" : "opacity-100"
      }`}
      style={{
        gridRow,
        gridColumn,
        zIndex: tile.z_index
      }}
    >
      <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">{tile.tile_type}</div>
      {notice ? (
        <>
          <h2 className="text-balance font-semibold text-white">{notice.title}</h2>
          <p className="mt-2 line-clamp-6 text-sm text-zinc-300">{notice.summary ?? notice.body}</p>
        </>
      ) : (
        <p className="text-sm text-zinc-500">No notice bound</p>
      )}
    </article>
  )
}

export async function DisplayCanvas() {
  let bundle: DisplayBundle
  try {
    bundle = await fetchBundle()
  } catch {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Cannot load display bundle — start FastAPI on :8000 or set NEXT_PUBLIC_API_BASE
      </div>
    )
  }

  if (bundle.layout_version_id === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <p>No published layout.</p>
        <p className="text-sm text-zinc-600">POST /api/layouts, add tiles, then publish a version.</p>
      </div>
    )
  }

  const tiles = [...bundle.tiles].sort(
    (a, b) => a.tile.z_index - b.tile.z_index || a.tile.id - b.tile.id
  )

  return (
    <div
      className="grid h-full w-full bg-zinc-950 p-2"
      style={{
        gridTemplateColumns: `repeat(${bundle.grid_cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${bundle.grid_rows}, minmax(0, 1fr))`,
        gap: bundle.gap_px
      }}
    >
      {tiles.map((item) => (
        <TileCard key={item.tile.id} item={item} />
      ))}
    </div>
  )
}
