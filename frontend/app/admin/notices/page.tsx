"use client"

import { useCallback, useEffect, useState } from "react"
import api from "@/lib/api-client"
import type { NoticeRead } from "@/lib/types"

function PriorityBadge({ priority }: { priority: number }) {
  const cls = priority >= 70 ? "bg-red-900/30 text-red-400"
    : priority >= 50 ? "bg-amber-900/30 text-amber-400"
    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>P{priority}</span>
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<NoticeRead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<NoticeRead | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: "", body: "", summary: "", category: "", priority: 50 })
  const [saving, setSaving] = useState(false)

  const loadNotices = useCallback(async () => {
    try {
      const data = await api.notices.list()
      setNotices(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadNotices() }, [loadNotices])

  const filtered = notices.filter((n) =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.category ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  function startCreate() {
    setForm({ title: "", body: "", summary: "", category: "", priority: 50 })
    setCreating(true)
    setEditing(null)
  }

  function startEdit(notice: NoticeRead) {
    setForm({
      title: notice.title,
      body: notice.body,
      summary: notice.summary ?? "",
      category: notice.category ?? "",
      priority: notice.priority,
    })
    setEditing(notice)
    setCreating(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const updated = await api.notices.update(editing.id, {
          title: form.title, body: form.body,
          summary: form.summary || null, category: form.category || null,
          priority: form.priority,
        })
        setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
        setEditing(null)
      } else {
        const created = await api.notices.create({
          title: form.title, body: form.body,
          summary: form.summary || undefined, category: form.category || undefined,
          priority: form.priority,
        })
        setNotices((prev) => [...prev, created])
        setCreating(false)
      }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try {
      await api.notices.delete(id)
      setNotices((prev) => prev.filter((n) => n.id !== id))
      if (editing?.id === id) setEditing(null)
    } catch (e) { console.error(e) }
  }

  const showForm = creating || editing

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Notices</h1>
          <p className="mt-1 text-sm text-zinc-500">{notices.length} total notices</p>
        </div>
        <button onClick={startCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
          + New Notice
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notices..."
          className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500/50" />
      </div>

      <div className="flex gap-6">
        {/* List */}
        <div className="flex-1 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-sm text-zinc-500">{search ? "No notices match your search." : "No notices yet."}</p>
            </div>
          ) : (
            filtered.map((notice) => (
              <div key={notice.id}
                onClick={() => startEdit(notice)}
                className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                  editing?.id === notice.id
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{notice.title}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{notice.body}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    {notice.category && (
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                        {notice.category}
                      </span>
                    )}
                    <PriorityBadge priority={notice.priority} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Edit/Create panel */}
        {showForm && (
          <div className="w-80 flex-shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-4">
            <h2 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {editing ? `Edit Notice #${editing.id}` : "New Notice"}
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Title</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Body</span>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4}
                  className="mt-1 w-full rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Summary</span>
                <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Optional short summary"
                  className="mt-1 w-full rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Category</span>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. academic"
                    className="mt-1 w-full rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Priority</span>
                  <input type="number" value={form.priority} min={0} max={100}
                    onChange={(e) => setForm({ ...form, priority: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    className="mt-1 w-full rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 text-sm tabular-nums text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500" />
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={!form.title.trim() || saving}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
                <button onClick={() => { setEditing(null); setCreating(false) }}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  Cancel
                </button>
                {editing && (
                  <button onClick={() => handleDelete(editing.id)}
                    className="ml-auto rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20">
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
