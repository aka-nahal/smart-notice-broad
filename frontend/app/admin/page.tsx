"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import api from "@/lib/api-client"
import type { LayoutRead, NoticeRead, MediaAsset } from "@/lib/types"

function greeting(): { hello: string; emoji: string } {
  const h = new Date().getHours()
  if (h < 5)  return { hello: "Working late",  emoji: "🌙" }
  if (h < 12) return { hello: "Good morning",  emoji: "☀️" }
  if (h < 17) return { hello: "Good afternoon", emoji: "👋" }
  if (h < 21) return { hello: "Good evening",  emoji: "🌆" }
  return       { hello: "Good night",          emoji: "🌙" }
}

const STAT_ACCENTS = {
  blue:    { ring: "ring-blue-500/20",    icon: "from-blue-500 to-indigo-500",     glow: "shadow-blue-500/10" },
  emerald: { ring: "ring-emerald-500/20", icon: "from-emerald-500 to-teal-500",    glow: "shadow-emerald-500/10" },
  amber:   { ring: "ring-amber-500/20",   icon: "from-amber-500 to-orange-500",    glow: "shadow-amber-500/10" },
  violet:  { ring: "ring-violet-500/20",  icon: "from-violet-500 to-fuchsia-500",  glow: "shadow-violet-500/10" },
} as const

function StatCard({
  label, value, hint, icon, accent,
}: {
  label: string; value: string | number; hint?: string; icon: string; accent: keyof typeof STAT_ACCENTS
}) {
  const a = STAT_ACCENTS[accent]
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm p-4 transition-all duration-300 hover:ring-2 ${a.ring} hover:shadow-xl ${a.glow} gpu-hover`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>
          <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${a.icon} text-white text-base shadow-lg ${a.glow} gpu`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

const ACTION_ACCENTS = {
  blue:   { bar: "from-blue-500 to-indigo-500",     text: "group-hover:text-blue-600 dark:group-hover:text-blue-400" },
  indigo: { bar: "from-indigo-500 to-violet-500",   text: "group-hover:text-indigo-600 dark:group-hover:text-indigo-400" },
  amber:  { bar: "from-amber-500 to-orange-500",    text: "group-hover:text-amber-600 dark:group-hover:text-amber-400" },
  zinc:   { bar: "from-zinc-400 to-zinc-500",       text: "group-hover:text-zinc-700 dark:group-hover:text-zinc-200" },
} as const

function ActionTile({
  href, title, desc, icon, accent,
}: {
  href: string; title: string; desc: string; icon: string; accent: keyof typeof ACTION_ACCENTS
}) {
  const a = ACTION_ACCENTS[accent]
  return (
    <Link href={href}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-lg gpu-hover">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${a.bar} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg leading-none">{icon}</span>
        <h3 className={`text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition-colors ${a.text}`}>{title}</h3>
        <span className="ml-auto text-zinc-400 transition-transform duration-300 group-hover:translate-x-0.5">→</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
    </Link>
  )
}

export default function AdminDashboard() {
  const [layouts, setLayouts] = useState<LayoutRead[]>([])
  const [notices, setNotices] = useState<NoticeRead[]>([])
  const [media, setMedia] = useState<MediaAsset[]>([])
  const [resolution, setResolution] = useState<{ width: number | null; height: number | null; reported_at: string | null }>({ width: null, height: null, reported_at: null })
  const [loading, setLoading] = useState(true)
  const [hello, setHello] = useState<{ hello: string; emoji: string }>({ hello: "Welcome", emoji: "👋" })

  useEffect(() => {
    setHello(greeting())
    async function load() {
      try {
        const [l, n, m, r] = await Promise.all([
          api.layouts.list(),
          api.notices.list(),
          api.media.list(),
          fetch("/api/display/resolution").then((res) => res.json()).catch(() => ({})),
        ])
        setLayouts(l); setNotices(n); setMedia(m); setResolution(r)
      } catch (e) {
        console.error("Dashboard load failed", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const publishedVersions = layouts.flatMap((l) => l.versions.filter((v) => v.is_published).map((v) => ({ layout: l, version: v })))
  const livePreview = publishedVersions[0]
  const highPriority = notices.filter((n) => n.priority >= 70)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-blue-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      {/* Hero greeting */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {hello.hello} <span className="inline-block animate-fade-in-up">{hello.emoji}</span>
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">Here&apos;s what&apos;s happening on your notice board today.</p>
        </div>
        <Link href="/admin/builder"
          className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all gpu-hover">
          ✨ Open Builder
        </Link>
      </div>

      {/* Live status banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 dark:from-zinc-900/80 dark:via-zinc-900/60 dark:to-blue-950/30 p-5 shadow-sm gpu">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-3 w-3 items-center justify-center">
              {livePreview && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-pulse-ring" />}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${livePreview ? "bg-emerald-500" : "bg-zinc-400"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {livePreview ? `Live: ${livePreview.layout.name}` : "Nothing published yet"}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {livePreview
                  ? `v${livePreview.version.version} · ${livePreview.version.grid_cols}×${livePreview.version.grid_rows} grid · ${livePreview.version.tiles.length} tiles`
                  : "Publish a layout from the builder to bring your display alive"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {resolution.width && resolution.height ? (
              <span className="rounded-lg border border-zinc-200 dark:border-zinc-700/70 bg-white/60 dark:bg-zinc-800/50 px-2.5 py-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                🖥️ {resolution.width}×{resolution.height}
              </span>
            ) : (
              <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ No display connected
              </span>
            )}
            <Link href="/" target="_blank"
              className="rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 font-medium text-white dark:text-zinc-900 hover:opacity-90 transition-opacity">
              Open Display ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Layouts"    value={layouts.length}                          hint={`${publishedVersions.length} published`} icon="🗂️" accent="blue" />
        <StatCard label="Notices"    value={notices.length}                          hint={`${highPriority.length} high priority`} icon="📣" accent="amber" />
        <StatCard label="Media"      value={media.length}                            hint="images & video"                          icon="🖼️" accent="violet" />
        <StatCard label="Tiles live" value={livePreview?.version.tiles.length ?? 0}  hint="on the display"                          icon="✨" accent="emerald" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionTile href="/admin/builder"  icon="🧩" accent="blue"   title="Builder"  desc="Drag-and-drop grid editor" />
          <ActionTile href="/admin/layouts"  icon="🗂️" accent="indigo" title="Layouts"  desc="Versions & friendly presets" />
          <ActionTile href="/admin/notices"  icon="📣" accent="amber"  title="Notices"  desc="Create & schedule content" />
          <ActionTile href="/admin/settings" icon="⚙️" accent="zinc"   title="Settings" desc="Display & refresh config" />
        </div>
      </div>

      {/* Recent Notices (compact) */}
      {notices.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Recent Notices</h2>
            <Link href="/admin/notices" className="text-xs text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">View all →</Link>
          </div>
          <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
            {notices.slice(0, 5).map((notice) => (
              <div key={notice.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{notice.title}</p>
                  {notice.category && (
                    <span className="mt-0.5 inline-block text-[10px] uppercase tracking-wider text-zinc-500">{notice.category}</span>
                  )}
                </div>
                <span className={`ml-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  notice.priority >= 70 ? "bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20" :
                  notice.priority >= 50 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20" :
                  "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                }`}>P{notice.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
