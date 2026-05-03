"use client"

import { useState } from "react"
import { PeriodsTab } from "./periods-tab"
import { TeachersTab } from "./teachers-tab"
import { SettingsTab } from "./settings-tab"

type Tab = "periods" | "teachers" | "settings"

const TABS: { id: Tab; label: string; icon: string; hint: string }[] = [
  { id: "periods",  label: "Periods",  icon: "⏰", hint: "Master bell schedule" },
  { id: "teachers", label: "Teachers", icon: "👨‍🏫", hint: "People & their weekly grid" },
  { id: "settings", label: "Settings", icon: "⚙️", hint: "Display format" },
]

export default function TeachersPage() {
  const [tab, setTab] = useState<Tab>("periods")

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Teacher Tracker</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage periods, teachers, and how their status appears on display screens.
        </p>
      </div>

      {/* Tab strip */}
      <div className="mb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "text-blue-400"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "periods"  && <PeriodsTab />}
      {tab === "teachers" && <TeachersTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  )
}
