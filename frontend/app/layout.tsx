import type { Metadata } from "next"
import { DM_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme-provider"

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-geist-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "RunaNet — by FutureForge Studios",
  description: "RunaNet — AI-powered campus display, by FutureForge Studios Pvt. Ltd.",
  applicationName: "RunaNet",
  authors: [{ name: "FutureForge Studios Pvt. Ltd." }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} font-sans min-h-screen bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
