"use client"

import { useCallback, useEffect, useState } from "react"

interface WeatherData {
  city: string
  country: string
  temp: number
  feels_like: number
  temp_min: number
  temp_max: number
  humidity: number
  wind_speed: number
  description: string
  icon: string
  icon_url: string
}

interface ForecastItem {
  dt: number
  temp: number
  description: string
  icon: string
  icon_url: string
}

interface Props {
  city?: string
  units?: "metric" | "imperial"
  showForecast?: boolean
  compact?: boolean // for builder preview
  tempSize?: number   // px override for the main temperature
  citySize?: number   // px override for the city name
}

export function WeatherWidget({ city = "London", units = "metric", showForecast = false, compact = false, tempSize, citySize }: Props) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [forecast, setForecast] = useState<ForecastItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const unitLabel = units === "imperial" ? "°F" : "°C"
  const windLabel = units === "imperial" ? "mph" : "m/s"

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(`/api/weather/current?city=${encodeURIComponent(city)}&units=${units}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }))
        setError(err.detail || "Weather unavailable")
        return
      }
      setData(await res.json())
      setError(null)

      if (showForecast) {
        const fRes = await fetch(`/api/weather/forecast?city=${encodeURIComponent(city)}&units=${units}`)
        if (fRes.ok) {
          const fData = await fRes.json()
          setForecast(fData.items?.slice(0, 4) ?? [])
        }
      }
    } catch {
      setError("Cannot reach weather service")
    } finally {
      setLoading(false)
    }
  }, [city, units, showForecast])

  useEffect(() => {
    fetchWeather()
    const interval = setInterval(fetchWeather, 10 * 60 * 1000) // refresh every 10 min
    return () => clearInterval(interval)
  }, [fetchWeather])

  if (loading) {
    if (compact) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-400" />
          <span className="text-[8px] text-teal-500/60">weather</span>
        </div>
      )
    }
    return (
      <div className="flex h-full flex-col gap-2 p-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-2.5 w-20 rounded bg-zinc-300/60 dark:bg-zinc-700/60" />
            <div className="h-2 w-14 rounded bg-zinc-300/40 dark:bg-zinc-700/40" />
          </div>
          <div className="h-10 w-10 rounded-full bg-zinc-300/60 dark:bg-zinc-700/60" />
        </div>
        <div className="h-8 w-16 rounded bg-zinc-300/60 dark:bg-zinc-700/60 mt-1" />
        <div className="flex gap-2 mt-auto">
          <div className="h-2 w-12 rounded bg-zinc-300/40 dark:bg-zinc-700/40" />
          <div className="h-2 w-14 rounded bg-zinc-300/40 dark:bg-zinc-700/40" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
        <span className="text-xs">🌤️</span>
        <span className={`${compact ? "text-[8px]" : "text-xs"} text-red-400/70`}>{error}</span>
      </div>
    )
  }

  if (!data) return null

  // Compact mode for builder preview
  if (compact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1">
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-teal-400/50">weather</span>
        <div className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.icon_url} alt={data.description} className="h-6 w-6" />
          <span className="text-base font-bold tabular-nums text-teal-300/80">{Math.round(data.temp)}{unitLabel}</span>
        </div>
        <span className="text-[9px] text-zinc-500 capitalize truncate max-w-full">{data.description}</span>
        <span className="text-[8px] text-zinc-600">{data.city}</span>
      </div>
    )
  }

  // Full mode for display
  const cityStyle: React.CSSProperties = typeof citySize === "number" ? { fontSize: `${citySize}px` } : {}
  const tempStyle: React.CSSProperties = typeof tempSize === "number"
    ? { fontSize: `${tempSize}px`, lineHeight: 1 }
    : {}
  return (
    <div className="flex h-full flex-col justify-between p-3" style={{ color: "var(--tile-fg, #ffffff)" }}>
      {/* Top: city + main temp */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium" style={{ color: "var(--tile-fg-muted, #a1a1aa)", ...(cityStyle.fontSize ? cityStyle : { fontSize: "0.75rem" }) }}>{data.city}, {data.country}</p>
            <p className="text-xs capitalize" style={{ color: "var(--tile-fg-subtle, #71717a)" }}>{data.description}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.icon_url} alt={data.description} className="h-12 w-12 -mr-1" />
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="font-bold tabular-nums" style={tempStyle.fontSize ? tempStyle : { fontSize: "1.875rem", lineHeight: 1 }}>{Math.round(data.temp)}</span>
          <span className="text-sm mb-1" style={{ color: "var(--tile-fg-muted, #a1a1aa)" }}>{unitLabel}</span>
        </div>
      </div>

      {/* Middle: details */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-zinc-500">
        <span>Feels {Math.round(data.feels_like)}{unitLabel}</span>
        <span>H:{Math.round(data.temp_max)}{unitLabel} L:{Math.round(data.temp_min)}{unitLabel}</span>
        <span>Humidity {data.humidity}%</span>
        <span>Wind {data.wind_speed} {windLabel}</span>
      </div>

      {/* Bottom: forecast */}
      {showForecast && forecast.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between">
          {forecast.map((f, i) => {
            const time = new Date(f.dt * 1000)
            const hour = time.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-zinc-600">{hour}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.icon_url} alt={f.description} className="h-6 w-6" />
                <span className="text-[10px] font-medium tabular-nums text-zinc-400">{Math.round(f.temp)}{unitLabel}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
