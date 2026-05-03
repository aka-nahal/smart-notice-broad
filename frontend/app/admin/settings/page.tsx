"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api-client"
import type { LayoutRead } from "@/lib/types"
import { loadScreenSaverConfig, type ScreenSaverConfig, type ScreenSaverContent } from "@/components/screen-saver"
import { MediaPicker } from "@/components/media-picker"

const RESOLUTION_PRESETS = [
  { label: "Full HD",      w: 1920, h: 1080, desc: "1920×1080 (16:9)" },
  { label: "QHD",          w: 2560, h: 1440, desc: "2560×1440 (16:9)" },
  { label: "4K UHD",       w: 3840, h: 2160, desc: "3840×2160 (16:9)" },
  { label: "Portrait FHD", w: 1080, h: 1920, desc: "1080×1920 (9:16)" },
  { label: "Ultrawide",    w: 2560, h: 1080, desc: "2560×1080 (21:9)" },
  { label: "720p",         w: 1280, h: 720,  desc: "1280×720 (16:9)"  },
] as const

const REFRESH_OPTIONS = [
  { label: "10 seconds", value: 10  },
  { label: "30 seconds", value: 30  },
  { label: "1 minute",   value: 60  },
  { label: "2 minutes",  value: 120 },
  { label: "5 minutes",  value: 300 },
] as const

function getSettings() {
  if (typeof window === "undefined")
    return { resW: 1920, resH: 1080, defaultCols: 12, defaultRows: 8, defaultGap: 8, refreshInterval: 30 }
  try {
    const raw = localStorage.getItem("snb-settings")
    if (raw) return JSON.parse(raw)
  } catch {}
  return { resW: 1920, resH: 1080, defaultCols: 12, defaultRows: 8, defaultGap: 8, refreshInterval: 30 }
}

function saveSettings(s: Record<string, number>) {
  localStorage.setItem("snb-settings", JSON.stringify(s))
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
      <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6">
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const [layouts, setLayouts]   = useState<LayoutRead[]>([])
  const [loading, setLoading]   = useState(true)
  const [saved,   setSaved]     = useState(false)

  const [settings,   setSettings]   = useState(getSettings)
  const [customResW, setCustomResW] = useState(settings.resW)
  const [customResH, setCustomResH] = useState(settings.resH)
  const [saver, setSaver] = useState<ScreenSaverConfig | null>(null)

  // OpenWeather config — managed independently of localStorage so it lives
  // server-side and is shared across every device that loads the display.
  const [weatherKey, setWeatherKey] = useState<string>("")
  const [weatherKeySaved, setWeatherKeySaved] = useState<boolean>(false)
  const [weatherCity, setWeatherCity] = useState<string>("London")
  const [weatherTest, setWeatherTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [weatherBusy, setWeatherBusy] = useState<"idle" | "test" | "geo">("idle")

  useEffect(() => {
    api.layouts.list().then(setLayouts).finally(() => setLoading(false))
    fetch("/api/settings/screen_saver")
      .then((r) => r.json())
      .then((j) => setSaver(loadScreenSaverConfig(j.value)))
      .catch(() => setSaver(loadScreenSaverConfig(null)))
    // Load weather settings — for the API key we only learn whether one is
    // saved (boolean), not the value itself, so the input shows a placeholder
    // and a "Replace key" affordance instead of leaking a secret to the UI.
    fetch("/api/settings/weather_api_key")
      .then((r) => r.json())
      .then((j) => setWeatherKeySaved(typeof j.value === "string" && j.value.length > 0))
      .catch(() => {})
    fetch("/api/settings/weather_default_city")
      .then((r) => r.json())
      .then((j) => { if (typeof j.value === "string" && j.value) setWeatherCity(j.value) })
      .catch(() => {})
  }, [])

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveWeatherKey() {
    if (!weatherKey.trim()) return
    await fetch("/api/settings/weather_api_key", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: weatherKey.trim() }),
    })
    setWeatherKey("")
    setWeatherKeySaved(true)
    setWeatherTest(null)
    flashSaved()
  }

  async function clearWeatherKey() {
    await fetch("/api/settings/weather_api_key", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "" }),
    })
    setWeatherKeySaved(false)
    setWeatherTest(null)
    flashSaved()
  }

  async function saveWeatherCity(city: string) {
    setWeatherCity(city)
    await fetch("/api/settings/weather_default_city", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: city }),
    })
    flashSaved()
  }

  async function testWeather() {
    setWeatherBusy("test")
    setWeatherTest(null)
    try {
      const res = await fetch("/api/weather/test")
      const j = await res.json()
      if (res.ok && j.ok) {
        setWeatherTest({ ok: true, message: `${j.city}${j.country ? ", " + j.country : ""} — ${Math.round(j.temp)}°C, ${j.description}` })
      } else {
        setWeatherTest({ ok: false, message: j.message || j.detail || "Test failed" })
      }
    } catch (e) {
      setWeatherTest({ ok: false, message: e instanceof Error ? e.message : "Network error" })
    } finally {
      setWeatherBusy("idle")
    }
  }

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setWeatherTest({ ok: false, message: "This browser does not expose geolocation." })
      return
    }
    setWeatherBusy("geo")
    setWeatherTest(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`/api/weather/reverse?lat=${latitude}&lon=${longitude}`)
          const j = await res.json()
          if (res.ok && j.city) {
            await saveWeatherCity(j.city)
            setWeatherTest({ ok: true, message: `Detected ${j.city}${j.state ? ", " + j.state : ""}${j.country ? ", " + j.country : ""}` })
          } else {
            setWeatherTest({ ok: false, message: j.detail || "Could not resolve coordinates" })
          }
        } catch (e) {
          setWeatherTest({ ok: false, message: e instanceof Error ? e.message : "Geocoding failed" })
        } finally {
          setWeatherBusy("idle")
        }
      },
      (err) => {
        setWeatherTest({ ok: false, message: err.message || "Location permission denied" })
        setWeatherBusy("idle")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    )
  }

  async function updateSaver(patch: Partial<ScreenSaverConfig>) {
    const next = { ...(saver ?? loadScreenSaverConfig(null)), ...patch }
    setSaver(next)
    try {
      await fetch("/api/settings/screen_saver", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      })
      flashSaved()
    } catch (e) {
      console.error("Failed to save screen saver settings", e)
    }
  }

  function updateSetting(key: string, value: number) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function applyResolution(w: number, h: number) {
    const next = { ...settings, resW: w, resH: h }
    setSettings(next)
    setCustomResW(w)
    setCustomResH(h)
    saveSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function setActiveLayout(layout: LayoutRead) {
    const ver = layout.versions[0]
    if (!ver) return
    try {
      await api.versions.publish(layout.id, ver.id)
      setLayouts(await api.layouts.list())
    } catch (e) {
      console.error("Publish failed", e)
    }
  }

  const activeLayout = layouts.find((l) => l.versions.some((v) => v.is_published))
  const displayUrl   = typeof window !== "undefined" ? `${window.location.origin}/display` : "/display"

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">Configure display and default preferences</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Saved
          </span>
        )}
      </div>

      <div className="space-y-6">

        {/* ── Display Resolution ─────────────────────────────────────────── */}
        <Section>
          <SectionHeader title="Display Resolution" desc="Target resolution for the display screen. Affects how the layout is previewed." />
          <div className="grid grid-cols-3 gap-2 mb-4">
            {RESOLUTION_PRESETS.map((r) => {
              const isActive = settings.resW === r.w && settings.resH === r.h
              return (
                <button
                  key={r.label}
                  onClick={() => applyResolution(r.w, r.h)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <p className="text-xs font-medium">{r.label}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{r.desc}</p>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Custom:</span>
            <input
              type="number" value={customResW} min={320} max={7680}
              onChange={(e) => setCustomResW(+e.target.value)}
              className="w-20 rounded-md bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 tabular-nums focus:border-blue-400"
            />
            <span className="text-zinc-400">×</span>
            <input
              type="number" value={customResH} min={240} max={4320}
              onChange={(e) => setCustomResH(+e.target.value)}
              className="w-20 rounded-md bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 tabular-nums focus:border-blue-400"
            />
            <button
              onClick={() => applyResolution(customResW, customResH)}
              className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700"
            >
              Apply
            </button>
          </div>
        </Section>

        {/* ── Default Grid Settings ──────────────────────────────────────── */}
        <Section>
          <SectionHeader title="Default Grid Settings" desc="Default values when creating new layouts" />
          <div className="flex flex-wrap gap-4">
            {[
              { key: "defaultCols", label: "Columns", val: settings.defaultCols },
              { key: "defaultRows", label: "Rows",    val: settings.defaultRows  },
              { key: "defaultGap",  label: "Gap (px)", val: settings.defaultGap  },
            ].map(({ key, label, val }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">{label}</span>
                <input
                  type="number" value={val} min={key === "defaultGap" ? 0 : 1} max={key === "defaultGap" ? 32 : 24}
                  onChange={(e) => updateSetting(key, +e.target.value)}
                  className="w-20 rounded-md bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 tabular-nums focus:border-blue-400"
                />
              </label>
            ))}
          </div>
        </Section>

        {/* ── Display Refresh Interval ───────────────────────────────────── */}
        <Section>
          <SectionHeader title="Display Refresh Interval" desc="How often the live display checks for layout updates" />
          <div className="flex flex-wrap gap-2">
            {REFRESH_OPTIONS.map((opt) => {
              const isActive = settings.refreshInterval === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => updateSetting("refreshInterval", opt.value)}
                  className={`rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── OpenWeather API ────────────────────────────────────────────── */}
        <Section>
          <SectionHeader
            title="OpenWeather"
            desc="API key + default location for the Weather tile. Get a free key at openweathermap.org/api."
          />

          <div className="space-y-4">
            {/* API key */}
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-2">API Key</label>
              {weatherKeySaved ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2">
                  <span className="text-base">🔑</span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 flex-1">Key saved (hidden for safety)</span>
                  <button
                    onClick={() => setWeatherKeySaved(false)}
                    className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    Replace
                  </button>
                  <button
                    onClick={clearWeatherKey}
                    className="text-[11px] text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={weatherKey}
                    onChange={(e) => setWeatherKey(e.target.value)}
                    placeholder="paste your OpenWeather API key…"
                    autoComplete="off"
                    className="flex-1 rounded-md bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-400 font-mono"
                  />
                  <button
                    onClick={saveWeatherKey}
                    disabled={!weatherKey.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-30"
                  >
                    Save
                  </button>
                </div>
              )}
              <p className="text-[10px] text-zinc-500 mt-1">
                The key is stored server-side and never exposed to the browser. New OpenWeather keys can take up to 2 hours to activate.
              </p>
            </div>

            {/* Default location */}
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-2">Default Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={weatherCity}
                  onChange={(e) => setWeatherCity(e.target.value)}
                  onBlur={() => saveWeatherCity(weatherCity)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  placeholder="City name (e.g. Mumbai, London, New York)"
                  className="flex-1 rounded-md bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-400"
                />
                <button
                  onClick={detectLocation}
                  disabled={weatherBusy !== "idle" || !weatherKeySaved}
                  title={weatherKeySaved ? "Use this device's location" : "Save an API key first"}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40"
                >
                  {weatherBusy === "geo" ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-blue-500" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  Use my location
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Used by Weather tiles that don&rsquo;t set their own city. Updates as you type, saves on blur.
              </p>
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-2">
              <button
                onClick={testWeather}
                disabled={weatherBusy !== "idle" || !weatherKeySaved}
                className="flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40"
              >
                {weatherBusy === "test" ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-blue-500" />
                ) : "🌤️"}
                Test connection
              </button>
              {weatherTest && (
                <span className={`text-xs ${weatherTest.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                  {weatherTest.ok ? "✓" : "✗"} {weatherTest.message}
                </span>
              )}
            </div>
          </div>
        </Section>

        {/* ── Screen Saver ───────────────────────────────────────────────── */}
        <Section>
          <SectionHeader
            title="Screen Saver"
            desc="What appears on the display after a period of inactivity. Lifts on any input."
          />
          {saver ? (
            <div className="space-y-4">
              {/* Enable */}
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Enable screen saver</p>
                  <p className="text-[10px] text-zinc-500">Engages after the device sits idle for the timeout below.</p>
                </div>
                <input
                  type="checkbox" checked={saver.enabled}
                  onChange={(e) => updateSaver({ enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-400 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/40"
                />
              </label>

              {/* Timeout */}
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-2">Timeout (when to appear)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "30 sec", v: 30 },
                    { label: "1 min",  v: 60 },
                    { label: "2 min",  v: 120 },
                    { label: "5 min",  v: 300 },
                    { label: "10 min", v: 600 },
                    { label: "30 min", v: 1800 },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => updateSaver({ timeoutSec: opt.v })}
                      disabled={!saver.enabled}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                        saver.timeoutSec === opt.v
                          ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-[10px] text-zinc-500">Custom:</span>
                    <input
                      type="number" min={10} max={86400}
                      value={saver.timeoutSec}
                      disabled={!saver.enabled}
                      onChange={(e) => updateSaver({ timeoutSec: Math.max(10, +e.target.value || 60) })}
                      className="w-20 rounded-md bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 tabular-nums focus:border-blue-400 disabled:opacity-40"
                    />
                    <span className="text-[10px] text-zinc-500">sec</span>
                  </div>
                </div>
              </div>

              {/* What appears */}
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-2">What appears</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { v: "clock",     label: "Clock",      icon: "🕐", desc: "Big time + date" },
                    { v: "slideshow", label: "Slideshow",  icon: "🖼️", desc: "Cycle through media" },
                    { v: "image",     label: "Still image", icon: "🌄", desc: "Single picture" },
                    { v: "black",     label: "Black",      icon: "▣",  desc: "Power-saving" },
                  ] as { v: ScreenSaverContent; label: string; icon: string; desc: string }[]).map((opt) => (
                    <button
                      key={opt.v}
                      disabled={!saver.enabled}
                      onClick={() => updateSaver({ content: opt.v })}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                        saver.content === opt.v
                          ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-transparent"
                      }`}
                    >
                      <p className="text-xs font-medium"><span className="mr-1">{opt.icon}</span>{opt.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image picker — only when content === "image" */}
              {saver.content === "image" && (
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-2">Pick an image</label>
                  <MediaPicker
                    kind="image"
                    multiple={false}
                    disabled={!saver.enabled}
                    selectedIds={
                      saver.imageUrl?.startsWith("/api/media/")
                        ? [parseInt(saver.imageUrl.replace("/api/media/", ""), 10)].filter((n) => !isNaN(n))
                        : []
                    }
                    onChange={(ids) => updateSaver({ imageUrl: ids.length ? `/api/media/${ids[0]}` : undefined })}
                  />
                  {/* Manual URL fallback for external images */}
                  <div className="mt-2">
                    <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-1">Or paste an external URL</label>
                    <input
                      type="text"
                      value={saver.imageUrl?.startsWith("/api/media/") ? "" : (saver.imageUrl ?? "")}
                      disabled={!saver.enabled}
                      onChange={(e) => updateSaver({ imageUrl: e.target.value || undefined })}
                      placeholder="https://…"
                      className="w-full rounded-md bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 focus:border-blue-400 disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              {/* Slideshow picker — only when content === "slideshow" */}
              {saver.content === "slideshow" && (
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-2">Pick slideshow images (click to add, in order)</label>
                  <MediaPicker
                    kind="image"
                    multiple
                    disabled={!saver.enabled}
                    selectedIds={saver.slideshowMediaIds ?? []}
                    onChange={(ids) => updateSaver({ slideshowMediaIds: ids })}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">Seconds per slide:</span>
                    <input
                      type="number" min={2} max={120}
                      value={saver.slideshowInterval ?? 8}
                      disabled={!saver.enabled}
                      onChange={(e) => updateSaver({ slideshowInterval: Math.max(2, +e.target.value || 8) })}
                      className="w-20 rounded-md bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200 outline-none border border-zinc-300 dark:border-zinc-700 tabular-nums focus:border-blue-400 disabled:opacity-40"
                    />
                  </div>
                </div>
              )}

              {/* Use camera presence */}
              <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Use camera presence (if available)</p>
                  <p className="text-[10px] text-zinc-500">Locks faster when no one is in front of the display.</p>
                </div>
                <input
                  type="checkbox" checked={saver.usePresence !== false}
                  disabled={!saver.enabled}
                  onChange={(e) => updateSaver({ usePresence: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-400 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/40"
                />
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-400" />
              Loading…
            </div>
          )}
        </Section>

        {/* ── Active Layout ──────────────────────────────────────────────── */}
        <Section>
          <SectionHeader title="Active Layout" desc="Choose which layout is displayed on screens" />
          {activeLayout && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Currently active: {activeLayout.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {activeLayout.versions[0]?.grid_cols}×{activeLayout.versions[0]?.grid_rows} · {activeLayout.versions[0]?.tiles.length} tiles
                </p>
              </div>
            </div>
          )}

          {layouts.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">No layouts yet. <a href="/admin/builder" className="text-blue-500 hover:underline">Create one</a>.</p>
          ) : (
            <div className="space-y-2">
              {layouts.map((layout) => {
                const isActive = layout.versions.some((v) => v.is_published)
                const ver = layout.versions[0]
                return (
                  <div
                    key={layout.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      isActive
                        ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/5"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {ver && (
                        <div className="relative h-8 w-12 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 overflow-hidden shrink-0">
                          {ver.tiles.map((t) => (
                            <div
                              key={t.id}
                              className="absolute bg-zinc-400/40 dark:bg-zinc-500/30 rounded-[1px]"
                              style={{
                                left:   `${(t.grid_x / ver.grid_cols) * 100}%`,
                                top:    `${(t.grid_y / ver.grid_rows) * 100}%`,
                                width:  `${(t.grid_w / ver.grid_cols) * 100}%`,
                                height: `${(t.grid_h / ver.grid_rows) * 100}%`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{layout.name}</p>
                        {layout.description && <p className="text-[10px] text-zinc-500">{layout.description}</p>}
                      </div>
                    </div>
                    {isActive ? (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                    ) : (
                      <button
                        onClick={() => setActiveLayout(layout)}
                        className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700"
                      >
                        Make Active
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* ── Display Access ─────────────────────────────────────────────── */}
        <Section>
          <SectionHeader title="Display Access" desc="Open this URL on your display screen" />
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-700 truncate">
              {displayUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(displayUrl)}
              className="shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700"
            >
              Copy URL
            </button>
            <a
              href="/display" target="_blank"
              className="shrink-0 rounded-lg bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 px-4 py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/20"
            >
              Open Display &nearr;
            </a>
          </div>
        </Section>

      </div>
    </div>
  )
}
