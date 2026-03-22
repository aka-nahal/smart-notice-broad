import Link from "next/link"

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Smart Notice Board</h1>
      <p className="text-zinc-400">MVP shell — FastAPI + Next.js + SQLite + Gemini hooks.</p>
      <nav className="flex flex-col gap-2 text-sky-400">
        <Link href="/display" className="hover:underline">
          Fullscreen display
        </Link>
        <Link href="/admin" className="hover:underline">
          Admin (stub)
        </Link>
      </nav>
    </main>
  )
}
