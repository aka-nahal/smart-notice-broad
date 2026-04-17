"use client"

import { useCallback, useEffect, useState } from "react"

interface SensorReading {
  sensor: string
  value: number | boolean
  unit: string
  label: string
  icon: string
  mock: boolean
  timestamp: string
}

interface SensorStatus {
  gpio_available: boolean
  dht_available: boolean
  mock_mode: boolean
  cached_sensors: string[]
  supported: string[]
}

const SENSOR_COLOR: Record<string, string> = {
  temperature: "text-orange-500 dark:text-orange-400",
  humidity:    "text-sky-500 dark:text-sky-400",
  motion:      "text-violet-500 dark:text-violet-400",
  light:       "text-yellow-500 dark:text-yellow-400",
}

const REFRESH_OPTIONS = [5, 10, 30, 60]

function StatusBadge({ status }: { status: SensorStatus | null }) {
  if (!status) return null
  const live = status.gpio_available && !status.mock_mode
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
      live
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
        : "border-amber-500/30 bg-amber-500/10 text-amber-500"
    }`}>
      <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
      {live ? "Live GPIO readings" : "Mock data (no GPIO)"}
    </div>
  )
}

function SensorCard({ reading }: { reading: SensorReading }) {
  const colorCls = SENSOR_COLOR[reading.sensor] ?? "text-teal-500 dark:text-teal-400"
  const isMotion = reading.sensor === "motion"

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{reading.icon}</span>
        {reading.mock && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-500">
            mock
          </span>
        )}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{reading.label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${colorCls}`}>
        {isMotion
          ? (reading.value ? "Detected" : "Clear")
          : <>{typeof reading.value === "number" ? reading.value : String(reading.value)}<span className="ml-0.5 text-base text-zinc-400">{reading.unit}</span></>}
      </p>
      <p className="mt-2 text-[10px] text-zinc-400 tabular-nums">
        Last reading {new Date(reading.timestamp).toLocaleTimeString()}
      </p>
    </div>
  )
}

export default function SensorsPage() {
  const [readings, setReadings] = useState<Record<string, SensorReading>>({})
  const [status, setStatus] = useState<SensorStatus | null>(null)
  const [refreshSec, setRefreshSec] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        fetch("/api/sensors/readings").then((res) => res.json()),
        fetch("/api/sensors/status").then((res) => res.json()),
      ])
      setReadings(r)
      setStatus(s)
      setError(null)
      setLastFetch(new Date())
    } catch (e) {
      console.error(e)
      setError("Failed to fetch sensor data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, refreshSec * 1000)
    return () => clearInterval(id)
  }, [fetchAll, refreshSec])

  const entries = Object.values(readings)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sensors</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live readings from connected hardware. Use the Sensor tile in the Builder to embed any of these on the display.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Refresh:</span>
          {REFRESH_OPTIONS.map((sec) => (
            <button key={sec} onClick={() => setRefreshSec(sec)}
              className={`rounded-md px-2 py-1 font-medium transition-colors ${
                refreshSec === sec
                  ? "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
              }`}>
              {sec}s
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          {lastFetch && <span className="tabular-nums">Updated {lastFetch.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Refresh now
          </button>
        </div>
      </div>

      {/* Status detail */}
      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">GPIO</p>
            <p className={`mt-0.5 text-sm font-medium ${status.gpio_available ? "text-emerald-500" : "text-zinc-500"}`}>
              {status.gpio_available ? "Available" : "Not available"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">DHT</p>
            <p className={`mt-0.5 text-sm font-medium ${status.dht_available ? "text-emerald-500" : "text-zinc-500"}`}>
              {status.dht_available ? "Available" : "Not available"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Supported</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">{status.supported.length}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Cached</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">{status.cached_sensors.length}</p>
          </div>
        </div>
      )}

      {/* Readings */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={fetchAll} className="mt-2 text-xs text-red-400 hover:text-red-300">Retry</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 px-4 py-10 text-center">
          <p className="text-sm text-zinc-500">No sensor readings available</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map((r) => <SensorCard key={r.sensor} reading={r} />)}
        </div>
      )}

      {/* How to use */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Use on display</p>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          Open the <span className="font-medium">Builder</span>, drag a <span className="font-medium">Sensor</span> tile from the Widgets palette, then pick <em>all</em> or a single sensor type in the inspector. Mock data is returned automatically when GPIO is unavailable.
        </p>
      </div>
    </div>
  )
}
