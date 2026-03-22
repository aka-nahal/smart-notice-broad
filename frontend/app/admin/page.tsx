export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mt-2 text-zinc-400">
        Next: drag-drop builder (react-grid-layout or custom), notice CRUD, AI draft calling{" "}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-sm">POST /api/ai/draft-notice</code>.
      </p>
    </main>
  )
}
