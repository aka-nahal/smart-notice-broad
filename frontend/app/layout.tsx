import type { Metadata } from "next"
import { DM_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-geist-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Smart Notice Board",
  description: "AI-powered digital notice display"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} ${mono.variable} font-sans min-h-screen`}>{children}</body>
    </html>
  )
}
