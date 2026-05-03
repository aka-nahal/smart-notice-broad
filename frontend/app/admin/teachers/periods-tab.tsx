"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api-client"
import type { PeriodRead } from "@/lib/types"

const EMPTY = { name: "", start_time: "09:00", end_time: "10:00", sort_order: 0 }

export function PeriodsTab() {
  const [periods, setPeriods] = useState<PeriodRead[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setPeriods(await api.periods.list())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function create() {
    setError(null)
    if (!form.name.trim()) return setError("Name required")
    if (form.start_time >= form.end_time) return setError("Start must be before end")
    setBusy(true)
    try {
      await api.periods.create({
        name: form.name.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        sort_order: form.sort_order || periods.length + 1,
      })
      await load()
      setShowCreate(false)
      setForm({ ...EMPTY })
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: number) {
    setError(null)
    if (editForm.start_time >= editForm.end_time) return setError("Start must be before end")
    setBusy(true)
    try {
      await api.periods.update(id, {
        name: editForm.name.trim(),
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        sort_order: editForm.sort_order,
      })
      await load()
      setEditingId(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this period? Teacher slots using it will be removed too.")) return
    setBusy(true)
    try {
      await api.periods.delete(id)
      await load()
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p: PeriodRead) {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      start_time: p.start_time,
      end_time: p.end_time,
      sort_order: p.sort_order,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Periods</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Master bell schedule — these periods are shared across all teachers.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(null) }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Add Period
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Name *</span>
              <input
                autoFocus value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="P1"
                className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Start time *</span>
              <input
                type="time" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">End time *</span>
              <input
                type="time" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-500">Order</span>
              <input
                type="number" value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-500/50"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={create} disabled={busy || !form.name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-500"
            >
              Add Period
            </button>
            <button
              onClick={() => { setShowCreate(false); setForm({ ...EMPTY }); setError(null) }}
              className="rounded-lg px-4 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-400" />
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <span className="text-3xl block mb-2">⏰</span>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No periods yet — add the first one above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 w-16">#</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Start</th>
                <th className="px-4 py-2.5">End</th>
                <th className="px-4 py-2.5">Duration</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const editing = editingId === p.id
                const dur = durationMin(p.start_time, p.end_time)
                return (
                  <tr key={p.id} className="border-b border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100/30 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{p.sort_order || "—"}</td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-blue-500/50 w-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <input
                          type="time" value={editForm.start_time}
                          onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                          className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-blue-500/50 w-28"
                        />
                      ) : (
                        <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{p.start_time}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <input
                          type="time" value={editForm.end_time}
                          onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                          className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-blue-500/50 w-28"
                        />
                      ) : (
                        <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{p.end_time}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {dur != null ? `${dur} min` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editing ? (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => saveEdit(p.id)} disabled={busy}
                            className="rounded-md bg-blue-600 px-2.5 py-1 text-[10px] text-white hover:bg-blue-500 disabled:opacity-50">
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="rounded-md px-2.5 py-1 text-[10px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => startEdit(p)}
                            className="rounded-md px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700">
                            Edit
                          </button>
                          <button onClick={() => remove(p.id)}
                            className="rounded-md px-2 py-1 text-[10px] text-red-400 hover:bg-red-900/20 border border-zinc-300 dark:border-zinc-700 hover:border-red-500/30">
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function durationMin(start: string, end: string): number | null {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if ([sh, sm, eh, em].some(Number.isNaN)) return null
  return (eh * 60 + em) - (sh * 60 + sm)
}
