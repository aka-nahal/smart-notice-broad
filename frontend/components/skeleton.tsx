"use client"

import { CSSProperties } from "react"

interface SkeletonProps {
  className?: string
  style?: CSSProperties
  rounded?: "sm" | "md" | "lg" | "xl" | "full"
}

const roundedMap = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
}

export function Skeleton({ className = "", style, rounded = "md" }: SkeletonProps) {
  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-zinc-200/60 dark:bg-zinc-800/60 ${roundedMap[rounded]} ${className}`}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  )
}

interface SkeletonTextProps {
  lines?: number
  widths?: string[]
  className?: string
}

export function SkeletonText({ lines = 3, widths, className = "" }: SkeletonTextProps) {
  const ws = widths ?? Array.from({ length: lines }, (_, i) =>
    i === lines - 1 ? "60%" : i === 0 ? "85%" : "100%"
  )
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {ws.slice(0, lines).map((w, i) => (
        <Skeleton key={i} className="h-3" style={{ width: w }} />
      ))}
    </div>
  )
}

export function SkeletonTile({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-full w-full flex-col gap-2 p-3 ${className}`}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

interface BrandedLoaderProps {
  message?: string
  fullScreen?: boolean
  /** 0–100. When provided, replaces the bouncing dots with a thin progress bar. */
  progress?: number
  /** Shrinks all proportions for tighter contexts (e.g. inside a small panel). */
  compact?: boolean
}

export function BrandedLoader({ message = "Loading…", fullScreen = false, progress, compact = false }: BrandedLoaderProps) {
  const markSize = compact ? "h-16 w-16" : "h-24 w-24"
  const wordmarkSize = compact ? "text-2xl" : "text-4xl"

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden ${
      fullScreen ? "fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-50" : "h-full w-full"
    } animate-fade-in-up`}>
      {/* Soft radial spotlight backdrop — subtle in light mode, glowy on dark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-loader-bg"
        style={{
          background: [
            "radial-gradient(circle at 50% 42%, rgb(244 114 95 / 0.10), transparent 55%)",
            "radial-gradient(circle at 30% 80%, rgb(99 102 241 / 0.06), transparent 60%)",
            "radial-gradient(circle at 70% 80%, rgb(168 85 247 / 0.05), transparent 60%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Mark with concentric radar-ping rings + breathing scale */}
        <div className={`relative ${markSize}`}>
          {/* 3 staggered rings — use rounded-2xl so they feel like the brand mark, not a tiny dot */}
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-rose-400/40 animate-pulse-ring" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-rose-400/25 animate-pulse-ring" style={{ animationDelay: "0.6s" }} />
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-rose-400/15 animate-pulse-ring" style={{ animationDelay: "1.2s" }} />

          {/* The mark itself — light/dark variants. Wrapped so animation lives on the wrapper. */}
          <div className={`relative ${markSize} animate-loader-breath`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/runanet-mark-mono.png"  alt="RunaNet" className="absolute inset-0 block dark:hidden h-full w-full object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/runanet-mark-color.png" alt="RunaNet" className="absolute inset-0 hidden dark:block h-full w-full object-contain" />
          </div>
        </div>

        {/* Wordmark + tagline + byline */}
        <div className="flex flex-col items-center gap-1.5">
          <p className={`${wordmarkSize} font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-100`}>
            <span>runa</span><span className="text-rose-500 dark:text-rose-400">net</span>
          </p>
          {!compact && (
            <p className="text-[10px] uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-500">
              A Smart Notice Board
            </p>
          )}
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 tracking-wide">
            by FutureForge Studios Pvt. Ltd.
          </p>
        </div>

        {/* Progress bar OR 3-dot wave loader */}
        {typeof progress === "number" ? (
          <div className="w-48 mt-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] tabular-nums text-zinc-500">
              {Math.round(Math.max(0, Math.min(100, progress)))}%
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mt-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-loader-dot" />
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-loader-dot" style={{ animationDelay: "0.15s" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-loader-dot" style={{ animationDelay: "0.30s" }} />
          </div>
        )}

        {message && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
