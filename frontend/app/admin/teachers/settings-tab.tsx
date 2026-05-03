"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api-client"
import {
  DEFAULT_TEACHER_DISPLAY,
  TEACHER_DISPLAY_SETTINGS_KEY,
  type TeacherDisplaySettings,
} from "@/lib/types"

export function SettingsTab() {
  const [data, setData] = useState<TeacherDisplaySettings>(DEFAULT_TEACHER_DISPLAY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.appSettings
      .get<TeacherDisplaySettings>(TEACHER_DISPLAY_SETTINGS_KEY)
      .then((r) => {
        if (cancelled) return
        if (r.value) setData({ ...DEFAULT_TEACHER_DISPLAY, ...r.value })
      })
      .catch(() => { /* fall back to defaults */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function save() {
    setSaving(true)
    try {
      await api.appSettings.put(TEACHER_DISPLAY_SETTINGS_KEY, data)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof TeacherDisplaySettings>(k: K, v: TeacherDisplaySettings[K]) {
    setData((d) => ({ ...d, [k]: v }))
    setSavedAt(null)
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Display format</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Controls how teacher status & schedule cards render on display screens.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 p-5">
        {/* Time format */}
        <Row label="Time format" hint="How period start/end times are displayed.">
          <div className="flex gap-2">
            {(["24h", "12h"] as const).map((opt) => (
              <button key={opt}
                onClick={() => update("timeFormat", opt)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                  data.timeFormat === opt
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {opt === "24h" ? "24-hour (14:30)" : "12-hour (2:30 PM)"}
              </button>
            ))}
          </div>
        </Row>

        {/* Card style */}
        <Row label="Card style" hint="Compact = name + status only. Detailed = include schedule.">
          <div className="flex gap-2">
            {(["compact", "detailed"] as const).map((opt) => (
              <button key={opt}
                onClick={() => update("cardStyle", opt)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border capitalize ${
                  data.cardStyle === opt
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Row>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <Toggle
          label="Show subject" hint="Include the subject name on the teacher card."
          value={data.showSubject} onChange={(v) => update("showSubject", v)}
        />
        <Toggle
          label="Show room" hint="Include classroom / cabin reference."
          value={data.showRoom} onChange={(v) => update("showRoom", v)}
        />
        <Toggle
          label="Show next class" hint="Append the upcoming class when the teacher is free."
          value={data.showNextClass} onChange={(v) => update("showNextClass", v)}
        />
        <Toggle
          label="Show status note" hint="Show the manual note (e.g. 'In meeting until 3pm')."
          value={data.showStatusNote} onChange={(v) => update("showStatusNote", v)}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save} disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-emerald-400">Saved.</span>
        )}
      </div>
    </div>
  )
}

function Row({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm text-zinc-800 dark:text-zinc-200">{label}</p>
        {hint && <p className="text-[11px] text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-4" : "translate-x-0.5"
        }`} />
      </button>
    </Row>
  )
}
