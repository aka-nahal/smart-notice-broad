"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { rectToGridPlacement } from "@/lib/grid-engine"
import type { DisplayBundle, DisplayTileDTO, TileConfig } from "@/lib/types"
import { ClockWidget } from "@/components/clock-widget"
import { WeatherWidget } from "@/components/weather-widget"
import { CarouselDisplay, parseSlides } from "@/components/carousel-widget"
import { StackDisplay, parseStackChildren, type StackChild } from "@/components/stack-widget"
import { MediaImage } from "@/components/media-image"
import { SensorWidget } from "@/components/sensor-widget"
import { TimetableWidget } from "@/components/timetable-widget"
import { TeacherStatusWidget } from "@/components/teacher-status-widget"
import { TeachersListWidget } from "@/components/teachers-list-widget"
import { VideoPlayer } from "@/components/video-player"
import { PdfViewer } from "@/components/pdf-viewer"

const DEFAULT_REFRESH_MS = 30_000

function parseTileConfig(raw: string | null): TileConfig {
  if (!raw || raw === "{}") return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function tileSizeClass(w: number, h: number): "xs" | "sm" | "md" | "lg" | "xl" {
  const area = w * h
  if (area <= 2) return "xs"
  if (area <= 4) return "sm"
  if (area <= 9) return "md"
  if (area <= 16) return "lg"
  return "xl"
}

function WidgetContent({
  type, tileW, tileH, config, mediaUrl, mediaId,
}: {
  type: string
  tileW: number
  tileH: number
  config: TileConfig
  mediaUrl?: string | null
  mediaId?: number | null
}) {
  const size = tileSizeClass(tileW, tileH)
  // The bundle normally fills `mediaUrl` from `media_id`, but if that
  // column race-loses an update we'd show "No video configured" while the
  // tile clearly has a media asset attached. Deriving the URL from the
  // tile's own media_id is a safe local fallback.
  const mediaSrc = mediaUrl || (mediaId ? `/api/media/${mediaId}` : undefined)

  if (type === "stack") {
    const stackItems = parseStackChildren(config.stackChildren)
    const interval = typeof config.stackInterval === "number" ? config.stackInterval : 8
    const transition = (config.stackTransition as "fade" | "slide" | "none") || "slide"
    const showDots = config.stackShowDots !== "false" && config.stackShowDots !== false
    const paused = config.stackPaused === "true" || config.stackPaused === true
    return (
      <StackDisplay
        items={stackItems}
        interval={interval}
        transition={transition}
        showDots={showDots}
        paused={paused}
        renderChild={(child: StackChild) => {
          // Stacks store inline notice/emergency text directly (no DB
          // linkage). Render a simple text card for those cases.
          if (child.type === "notice" || child.type === "emergency") {
            return (
              <StackNoticeBlock
                inline={child.inline_notice ?? {}}
                config={child.config}
                emergency={child.type === "emergency"}
              />
            )
          }
          // Defensive: a stack-of-stacks would recurse forever.
          if (child.type === "stack") {
            return <p className="p-2 text-sm text-zinc-500">Nested stacks are not supported.</p>
          }
          return (
            <WidgetContent
              type={child.type}
              tileW={tileW}
              tileH={tileH}
              config={child.config}
              mediaId={child.media_id ?? null}
            />
          )
        }}
      />
    )
  }
  if (type === "clock")
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <ClockWidget />
      </div>
    )
  if (type === "ticker") {
    const text = config.tickerText || "Welcome to the Smart Notice Board \u2022 Stay updated with the latest announcements \u2022 Have a great day!"
    return (
      <div className="flex h-full items-center overflow-hidden">
        <p className="animate-marquee whitespace-nowrap text-sm font-medium text-amber-300">
          {text}
        </p>
      </div>
    )
  }
  if (type === "banner") {
    const title = config.bannerTitle || "Smart Notice Board"
    const subtitle = config.bannerSubtitle
    // Tile-size-derived Tailwind class used when no explicit px is set.
    const autoTitleCls = size === "xl" ? "text-2xl" : size === "lg" ? "text-xl" : size === "md" ? "text-lg" : "text-base"
    const autoSubtitleCls = size === "xl" || size === "lg" ? "text-sm" : "text-xs"
    const titleStyle: React.CSSProperties = typeof config.bannerTitleSize === "number"
      ? { fontSize: `${config.bannerTitleSize}px`, lineHeight: 1.1 }
      : {}
    const subtitleStyle: React.CSSProperties = typeof config.bannerSubtitleSize === "number"
      ? { fontSize: `${config.bannerSubtitleSize}px`, lineHeight: 1.2 }
      : {}
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-r from-sky-600/30 to-indigo-600/30 px-6 gap-1">
        <p
          className={`text-center font-semibold text-white/90 ${titleStyle.fontSize ? "" : autoTitleCls}`}
          style={titleStyle}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className={`text-center text-white/60 ${subtitleStyle.fontSize ? "" : autoSubtitleCls}`}
            style={subtitleStyle}
          >
            {subtitle}
          </p>
        )}
      </div>
    )
  }
  if (type === "weather") {
    return (
      <WeatherWidget
        city={config.weatherCity || "London"}
        units={config.weatherUnits || "metric"}
        showForecast={config.weatherShowForecast !== "false" && config.weatherShowForecast !== false}
      />
    )
  }
  if (type === "carousel") {
    const slides = parseSlides(config.carouselSlides)
    return (
      <CarouselDisplay
        slides={slides}
        interval={config.carouselInterval || 5}
        transition={(config.carouselTransition as "fade" | "slide" | "none") || "fade"}
        showDots={config.carouselShowDots !== "false" && config.carouselShowDots !== false}
        showArrows={config.carouselShowArrows === "true" || config.carouselShowArrows === true}
        autoplay={config.carouselAutoplay !== "false" && config.carouselAutoplay !== false}
        showProgress={config.carouselShowProgress !== "false" && config.carouselShowProgress !== false}
        kenBurns={config.carouselKenBurns === "true" || config.carouselKenBurns === true}
        fit={(config.carouselFit as "cover" | "contain" | "fill") || "cover"}
      />
    )
  }
  if (type === "image" && config.imageUrl) {
    const fit = (config.imageFit as string) || "cover"
    const fitCls = fit === "fill" ? "object-fill" : fit === "contain" ? "object-contain" : "object-cover"
    return (
      <MediaImage src={config.imageUrl} alt={config.imageAlt} className={`absolute inset-0 h-full w-full ${fitCls}`} />
    )
  }
  if (type === "video") {
    const videoUrl = (config.videoUrl as string | undefined) || mediaSrc
    if (!videoUrl) return <p className="text-sm text-zinc-500">No video configured</p>
    // Kiosk videos always autoplay + loop with no chrome and no pause
    // overlay — a play button on a notice board doesn't make sense and
    // there's nobody to click it. The inspector's autoplay/loop/controls
    // toggles are intentionally ignored on the display.
    // Append `?vdebug` to the display URL to overlay a per-tile playback HUD.
    const debugHud = typeof window !== "undefined" && window.location.search.includes("vdebug")
    return (
      <VideoPlayer
        url={videoUrl}
        poster={config.videoPoster as string | undefined}
        fit={(config.videoFit as "cover" | "contain" | "fill") || "cover"}
        debugHud={debugHud}
      />
    )
  }
  if (type === "pdf") {
    const pdfUrl = (config.pdfUrl as string | undefined) || mediaSrc
    if (!pdfUrl) return <p className="text-sm text-zinc-500">No document configured</p>
    return (
      <PdfViewer
        url={pdfUrl}
        autoAdvanceSec={typeof config.pdfAutoAdvanceSec === "number" ? config.pdfAutoAdvanceSec : 0}
        page={typeof config.pdfPage === "number" ? config.pdfPage : 1}
        totalPages={typeof config.pdfTotalPages === "number" ? config.pdfTotalPages : undefined}
        showChrome={config.pdfShowChrome !== "false" && config.pdfShowChrome !== false}
        fit={(config.pdfFit as "page" | "width" | "height") || "page"}
      />
    )
  }
  if (type === "sensor") {
    return (
      <SensorWidget
        sensorType={config.sensorType as string || "all"}
        refreshSec={typeof config.sensorRefreshSec === "number" ? config.sensorRefreshSec : 30}
      />
    )
  }
  if (type === "timetable") {
    const ttId = config.timetableId
    if (!ttId) return <p className="text-sm text-zinc-500">Set timetableId in tile config</p>
    return (
      <TimetableWidget
        timetableId={ttId as number}
        showTeacher={config.timetableShowTeacher !== "false" && config.timetableShowTeacher !== false}
        showRoom={config.timetableShowRoom !== "false" && config.timetableShowRoom !== false}
      />
    )
  }
  if (type === "teacher_status") {
    const tId = config.teacherId
    if (!tId) return <p className="text-sm text-zinc-500">Set teacherId in tile config</p>
    return (
      <TeacherStatusWidget
        teacherId={tId as number}
        timetableId={config.timetableId as number | undefined}
        compact={size === "xs" || size === "sm"}
      />
    )
  }
  if (type === "teachers_list") {
    return (
      <TeachersListWidget
        filter={(config.teachersFilter as string) || "all"}
        scrollSpeed={typeof config.teachersScrollSpeed === "number" ? config.teachersScrollSpeed : 25}
        showAvatar={config.teachersShowAvatar !== "false" && config.teachersShowAvatar !== false}
        title={(config.teachersTitle as string) || "Teachers"}
      />
    )
  }
  return <p className="text-sm text-zinc-500">Widget: {type}</p>
}

function StackNoticeBlock({
  inline, config, emergency = false,
}: {
  inline: NonNullable<StackChild["inline_notice"]>
  config: TileConfig
  emergency?: boolean
}) {
  const align = (config.textAlign as string) ?? "left"
  const valign = (config.verticalAlign as string) ?? "center"
  const alignCls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"
  const itemAlignCls = align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start"
  const valignCls = valign === "center" ? "justify-center" : valign === "bottom" ? "justify-end" : "justify-start"
  const titleStyle: React.CSSProperties = {
    ...(config.fontFamily && { fontFamily: config.fontFamily }),
    ...(config.titleSize && { fontSize: config.titleSize }),
    ...(config.titleColor && { color: config.titleColor as string }),
  }
  const bodyStyle: React.CSSProperties = {
    ...(config.fontFamily && { fontFamily: config.fontFamily }),
    ...(config.bodySize && { fontSize: config.bodySize }),
    ...(config.textColor && { color: config.textColor as string }),
  }
  return (
    <div className={`relative flex h-full w-full flex-col gap-1 p-4 ${valignCls} ${itemAlignCls} ${emergency ? "animate-pulse-subtle bg-red-950/20" : ""}`}>
      {emergency && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
      )}
      {inline.category && (
        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
          emergency ? "bg-red-500/20 text-red-300" : "bg-white/10 text-zinc-400"
        }`}>
          {inline.category}
        </span>
      )}
      {inline.title && (
        <h2
          className={`text-balance font-semibold leading-snug ${emergency ? "text-red-100" : "text-white"} ${alignCls}`}
          style={titleStyle}
        >
          {inline.title}
        </h2>
      )}
      {inline.body && (
        <p
          className={`mt-1 leading-relaxed ${emergency ? "text-red-200/85" : "text-zinc-300"} ${alignCls}`}
          style={bodyStyle}
        >
          {inline.body}
        </p>
      )}
      {!inline.title && !inline.body && (
        <p className="text-sm text-zinc-500">Empty {emergency ? "alert" : "notice"}</p>
      )}
    </div>
  )
}

function NoticeContent({
  notice, tile, config, hasMedia,
}: {
  notice: DisplayTileDTO["notice"]; tile: DisplayTileDTO["tile"]; config: TileConfig; hasMedia: boolean
}) {
  if (!notice)
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">Empty tile</p>
      </div>
    )

  const size = tileSizeClass(tile.grid_w, tile.grid_h)
  const titleCls =
    size === "xl" ? "text-xl" : size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-sm"
  const bodyCls =
    size === "xl" ? "text-base line-clamp-[12]" :
    size === "lg" ? "text-sm line-clamp-8" :
    size === "md" ? "text-sm line-clamp-5" :
    size === "sm" ? "text-xs line-clamp-3" : "text-xs line-clamp-2"

  const align = (config.textAlign as string) ?? "left"
  const valign = (config.verticalAlign as string) ?? "top"
  const weight = (config.titleWeight as string) ?? "semibold"

  const alignCls    = align === "center" ? "text-center"  : align === "right"  ? "text-right"  : "text-left"
  const valignCls   = valign === "center" ? "justify-center" : valign === "bottom" ? "justify-end" : "justify-start"
  const itemAlignCls = align === "center" ? "items-center" : align === "right"  ? "items-end"   : "items-start"
  const weightCls   = weight === "normal"     ? "font-normal"     :
                      weight === "medium"     ? "font-medium"     :
                      weight === "bold"       ? "font-bold"       :
                      weight === "extrabold"  ? "font-extrabold"  : "font-semibold"

  const titleStyle: React.CSSProperties = {
    ...(config.fontFamily && { fontFamily: config.fontFamily }),
    ...(config.titleSize && { fontSize: config.titleSize }),
    ...(config.titleColor && { color: config.titleColor as string }),
  }
  const bodyStyle: React.CSSProperties = {
    ...(config.fontFamily && { fontFamily: config.fontFamily }),
    ...(config.bodySize && { fontSize: config.bodySize }),
    ...(config.textColor && { color: config.textColor as string }),
  }

  return (
    <div className={`flex h-full w-full flex-col gap-1 ${valignCls} ${itemAlignCls}`}>
      {notice.category && (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
          {notice.category}
        </span>
      )}
      <h2 className={`text-balance leading-snug text-white ${weightCls} ${titleCls} ${alignCls}`} style={titleStyle}>
        {notice.title}
      </h2>
      {(notice.summary || notice.body) && (
        <p className={`mt-2 leading-relaxed ${hasMedia ? "text-zinc-200" : "text-zinc-300"} ${bodyCls} ${alignCls}`} style={bodyStyle}>
          {notice.summary ?? notice.body}
        </p>
      )}
    </div>
  )
}

function priorityBorderColor(priority: number, isEmergency: boolean): string {
  if (isEmergency) return "border-red-500/70 shadow-red-500/20"
  if (priority >= 70) return "border-red-500/40"
  if (priority >= 50) return "border-amber-500/30"
  return "border-white/[0.06]"
}

function TileCardInner({ item }: { item: DisplayTileDTO }) {
  const { tile, notice, media_url, effective_priority, is_visible_by_schedule } = item
  const { gridRow, gridColumn } = rectToGridPlacement({
    x: tile.grid_x, y: tile.grid_y, w: tile.grid_w, h: tile.grid_h
  })
  const hidden = !is_visible_by_schedule
  const isWidget = ["clock", "ticker", "banner", "weather", "video", "carousel", "sensor", "timetable", "teacher_status", "teachers_list", "pdf", "stack"].includes(tile.tile_type)
  const hasMedia = !!media_url
  const hasNotice = !!notice
  const config = parseTileConfig(tile.config_json)
  const hasConfigImage = !!config.imageUrl
  const isMediaOnly = tile.tile_type === "image" || (hasMedia && !hasNotice && !isWidget) || (hasConfigImage && !hasNotice && !isWidget)
  const noPadding = isWidget || isMediaOnly || (hasMedia && hasNotice)
  const isEmergency = tile.is_emergency_slot || tile.tile_type === "emergency"
  const borderColor = priorityBorderColor(effective_priority, isEmergency)

  const customPad = typeof config.padding === "number" ? `${config.padding}px` : undefined
  const articleStyle: React.CSSProperties = {
    gridRow, gridColumn, zIndex: tile.z_index,
    ...(config.bgColor && { backgroundColor: config.bgColor as string }),
    ...(customPad && !noPadding && { padding: customPad }),
  }

  return (
    <article
      className={`relative overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-700 ${borderColor} ${
        config.bgColor ? "" : "bg-zinc-900/90"
      } ${hidden ? "opacity-20" : "opacity-100"} ${
        noPadding ? "p-0" : customPad ? "" : "p-4"
      } ${isEmergency && !hidden ? "animate-pulse-subtle" : ""}`}
      style={articleStyle}
    >
      {isEmergency && !hidden && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
      )}

      {isWidget ? (
        <WidgetContent type={tile.tile_type} tileW={tile.grid_w} tileH={tile.grid_h} config={config} mediaUrl={media_url} mediaId={tile.media_id} />
      ) : isMediaOnly ? (
        hasMedia ? (
          <MediaImage src={media_url!} alt={notice?.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : hasConfigImage ? (
          <MediaImage src={config.imageUrl!} alt={config.imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">No media</p>
          </div>
        )
      ) : hasMedia && hasNotice ? (
        <div className="relative h-full">
          <MediaImage src={media_url!} alt={notice!.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative z-10 flex h-full flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <NoticeContent notice={notice} tile={tile} config={config} hasMedia />
          </div>
        </div>
      ) : (
        <NoticeContent notice={notice} tile={tile} config={config} hasMedia={false} />
      )}
    </article>
  )
}

// Every bundle refresh creates fresh object references for each item, so React.memo's
// default reference check does nothing. JSON-stringify comparison is cheap for the
// tile counts this board handles (tens, not thousands) and lets unchanged tiles skip
// re-render, which is the actual win — the runtime cost is re-mounting heavy widgets
// (video, pdf, carousel) when their parent item is structurally identical.
const TileCard = memo(TileCardInner, (prev, next) =>
  JSON.stringify(prev.item) === JSON.stringify(next.item)
)

export function DisplayCanvas({ refreshInterval = DEFAULT_REFRESH_MS }: { refreshInterval?: number }) {
  const [bundle, setBundle] = useState<DisplayBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBundle = useCallback(async () => {
    try {
      const res = await fetch("/api/display/bundle", { cache: "no-store" })
      if (!res.ok) throw new Error(`${res.status}`)
      const data: DisplayBundle = await res.json()
      setBundle(data)
      setError(null)
    } catch {
      setError("Cannot load display bundle")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBundle()
    const interval = setInterval(fetchBundle, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchBundle, refreshInterval])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    )
  }

  if (error || !bundle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
        <p>{error || "No data"}</p>
        <button onClick={fetchBundle} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500 hover:text-zinc-300">
          Retry
        </button>
      </div>
    )
  }

  if (bundle.layout_version_id === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <p>No published layout.</p>
        <p className="text-sm text-zinc-600">
          Go to <a href="/admin/builder" className="text-blue-400 hover:underline">/admin/builder</a> to create and publish a layout.
        </p>
      </div>
    )
  }

  const tiles = [...bundle.tiles].sort(
    (a, b) => a.tile.z_index - b.tile.z_index || a.tile.id - b.tile.id
  )

  return (
    <div
      className="grid h-full w-full bg-zinc-950 p-2 transition-all duration-500"
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
