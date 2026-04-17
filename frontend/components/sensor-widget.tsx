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

interface Props {
  sensorType?: string   // "temperature" | "humidity" | "motion" | "light" | "all"
  refreshSec?: number
  compact?: boolean
}

const SENSOR_COLORS: Record<string, string> = {
  temperature: "text-orange-400",
  humidity:    "text-sky-400",
  motion:      "text-violet-400",
  light:       "text-yellow-400",
}

function SingleSensor({ reading, compact }: { reading: SensorReading; compact?: boolean }) {
  const colorCls = SENSOR_COLORS[reading.sensor] ?? "text-teal-400"
  const isMotion = reading.sensor === "motion"

  return (
    <div className={`flex flex-col items-center justify-center h-full gap-1 ${compact ? "scale-90" : ""}`}>
      <span className={compact ? "text-xl" : "text-3xl"}>{reading.icon}</span>
      {isMotion ? (
        <span className={`font-bold tabular-nums ${colorCls} ${compact ? "text-sm" : "text-2xl"}`}>
          {reading.value ? "Detected" : "Clear"}
        </span>
      ) : (
        <span className={`font-bold tabular-nums ${colorCls} ${compact ? "text-sm" : "text-2xl"}`}>
          {typeof reading.value === "number" ? reading.value : String(reading.value)}
          <span className="text-zinc-500 text-xs ml-0.5">{reading.unit}</span>
        </span>
      )}
      <span className={`text-zinc-500 ${compact ? "text-[9px]" : "text-xs"} uppercase tracking-wider`}>
        {reading.label}
      </span>
      {reading.mock && !compact && (
        <span className="text-[9px] text-zinc-700 mt-0.5">mock data</span>
      )}
    </div>
  )
}

function AllSensors({ readings, compact }: { readings: Record<string, SensorReading>; compact?: boolean }) {
  const entries = Object.values(readings)
  return (
    <div className={`grid h-full w-full gap-2 p-2 ${entries.length <= 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"}`}>
      {entries.map((r) => (
        <div key={r.sensor} className="flex flex-col items-center justify-center rounded-lg bg-zinc-800/40 gap-0.5">
          <span className="text-lg">{r.icon}</span>
          {r.sensor === "motion" ? (
            <span className={`font-semibold ${SENSOR_COLORS[r.sensor] ?? "text-teal-400"} ${compact ? "text-xs" : "text-sm"}`}>
              {r.value ? "Detected" : "Clear"}
            </span>
          ) : (
            <span className={`font-semibold tabular-nums ${SENSOR_COLORS[r.sensor] ?? "text-teal-400"} ${compact ? "text-xs" : "text-sm"}`}>
              {typeof r.value === "number" ? r.value : String(r.value)}
              <span className="text-zinc-600 text-[9px] ml-0.5">{r.unit}</span>
            </span>
          )}
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

export function SensorWidget({ sensorType = "all", refreshSec = 30, compact = false }: Props) {
  const [data, setData] = useState<SensorReading | Record<string, SensorReading> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const url = sensorType === "all"
        ? "/api/sensors/readings"
        : `/api/sensors/readings/${sensorType}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
      setError(null)
    } catch {
      setError("Sensor unavailable")
    } finally {
      setLoading(false)
    }
  }, [sensorType])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, refreshSec * 1000)
    return () => clearInterval(id)
  }, [fetchData, refreshSec])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
        <span className="text-lg">📡</span>
        <span className="text-xs text-red-400/70">{error || "No data"}</span>
      </div>
    )
  }

  if (sensorType === "all") {
    return <AllSensors readings={data as Record<string, SensorReading>} compact={compact} />
  }

  return <SingleSensor reading={data as SensorReading} compact={compact} />
}
