"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeCtx = createContext<ThemeContextValue>({ theme: "light", toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("runa-theme") as Theme | null
    if (stored === "dark" || stored === "light") {
      setTheme(stored)
    }
  }, [])

  // Apply the class to <html> whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("runa-theme", theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"))
  }, [])

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export function useTheme() {
  return useContext(ThemeCtx)
}
