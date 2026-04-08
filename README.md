# RunaNet

Digital notice board platform with:

- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Optional AI:** Gemini notice drafting

---

## What This App Does

- Renders a live display board from a published layout version
- Lets you build layouts in an admin builder UI
- Supports tile-based content (`notice`, `clock`, `ticker`, `banner`, `image`, `emergency`, etc.)
- Exposes REST APIs for notices, layouts/tiles, and AI draft generation

---

## Quickstart (Windows / PowerShell)

### 1) Start backend (repo root)

Run from repo root so DB path stays at `./data/noticeboard.db`.

```bash
pip install -r backend/requirements.txt
$env:PYTHONPATH="backend"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Backend health check:

```bash
curl http://127.0.0.1:8001/health
```

### 2) Start frontend (`frontend/`)

```bash
cd frontend
npm install
$env:API_URL="http://127.0.0.1:8001"
npm run dev
```

### 3) Open app

- Display: [http://localhost:3000/](http://localhost:3000/) (also `/display`)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)
- Builder: [http://localhost:3000/admin/builder](http://localhost:3000/admin/builder)

---

## Builder Workflow

1. Open `/admin/builder`
2. Add tiles from the left palette
3. Drag tiles in the grid canvas
4. Edit tile properties in the right inspector (type, position, size, z-index, notice link)
5. Click **Publish**
6. Open `/` to view the published board

### Current builder capabilities

- Add tile
- Move tile by drag and drop
- Edit tile fields in inspector
- Assign notices to notice tiles
- Delete tile
- Publish layout version

---

## API Overview

Base URL: `http://127.0.0.1:8001/api`

### Display

- `GET /display/bundle` - returns rendered tile bundle used by the frontend display

### Notices

- `GET /notices`
- `POST /notices`
- `GET /notices/{notice_id}`
- `PATCH /notices/{notice_id}`
- `DELETE /notices/{notice_id}`

### Layouts / tiles

- `GET /layouts`
- `POST /layouts`
- `GET /layouts/{layout_id}`
- `POST /layouts/{layout_id}/versions/{version_id}/tiles`
- `PATCH /layouts/{layout_id}/versions/{version_id}/tiles/{tile_id}`
- `DELETE /layouts/{layout_id}/versions/{version_id}/tiles/{tile_id}`
- `POST /layouts/{layout_id}/versions/{version_id}/publish`

### AI

- `POST /ai/draft-notice`

---

## Environment Variables

### Frontend

- `API_URL` - backend base URL used by server-side fetches (default: `http://127.0.0.1:8001`)

Notes:

- Browser `/api/*` requests are proxied by Next.js rewrites
- Server-side display fetches use `API_URL` directly

### Backend

Copy `backend/.env.example` to `backend/.env` and set:

- `GEMINI_API_KEY` (required only for AI draft endpoint)

---

## Repo Structure

```text
backend/
  app/
    routers/      # notices, layouts, display, ai
    models/       # SQLAlchemy models
    schemas/      # Pydantic schemas
    services/     # display bundle + ai service
frontend/
  app/            # Next.js app routes
  components/     # display + builder UI components
  lib/            # shared frontend types + grid math
```

---

## Troubleshooting

### Backend starts but shows no real layout data

You likely started backend from the wrong cwd and created a different SQLite file. Start backend from repo root with:

```bash
$env:PYTHONPATH="backend"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### Display says it cannot load bundle

- Confirm backend is running on `:8001`
- Confirm frontend has `API_URL=http://127.0.0.1:8001`
- Check `http://127.0.0.1:8001/api/display/bundle` directly

### Media tiles show placeholders

That means media URLs resolve to missing/unavailable backend media endpoints or files.
