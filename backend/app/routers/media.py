import hashlib
import os
import re
import uuid
from pathlib import Path
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.media import MediaAsset

router = APIRouter()

MEDIA_DIR = Path("./data/media")
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB (video files can be large)
ALLOWED_MIME = {
    # Images
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "image/avif", "image/bmp",
    # Video
    "video/mp4", "video/webm", "video/ogg", "video/quicktime",
    # Documents
    "application/pdf",
}
MIME_EXT = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif",
    "image/webp": ".webp", "image/svg+xml": ".svg", "image/avif": ".avif",
    "image/bmp": ".bmp",
    "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogv",
    "video/quicktime": ".mov",
    "application/pdf": ".pdf",
}
VIDEO_MIME = {"video/mp4", "video/webm", "video/ogg", "video/quicktime"}
PDF_MIME = {"application/pdf"}


def _ensure_media_dir():
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)


@router.post("")
async def upload_media(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type or file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {', '.join(sorted(ALLOWED_MIME))}",
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_UPLOAD_BYTES // 1024 // 1024} MB.")

    _ensure_media_dir()

    # Compute checksum for deduplication
    checksum = hashlib.sha256(data).hexdigest()

    # Check for duplicate
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.checksum_sha256 == checksum).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {
            "id": existing.id,
            "url": f"/api/media/{existing.id}",
            "kind": existing.kind,
            "mime_type": existing.mime_type,
            "bytes_size": existing.bytes_size,
            "filename": os.path.basename(existing.local_path),
            "created_at": existing.created_at.isoformat(),
            "duplicate": True,
        }

    ext = MIME_EXT.get(file.content_type, ".bin")
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = MEDIA_DIR / filename

    with open(filepath, "wb") as f:
        f.write(data)

    if file.content_type in VIDEO_MIME:
        kind = "video"
    elif file.content_type in PDF_MIME:
        kind = "pdf"
    else:
        kind = "image"
    asset = MediaAsset(
        kind=kind,
        local_path=str(filepath),
        mime_type=file.content_type,
        bytes_size=len(data),
        checksum_sha256=checksum,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return {
        "id": asset.id,
        "url": f"/api/media/{asset.id}",
        "kind": asset.kind,
        "mime_type": asset.mime_type,
        "bytes_size": asset.bytes_size,
        "filename": filename,
        "created_at": asset.created_at.isoformat(),
        "duplicate": False,
    }


@router.get("")
async def list_media(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaAsset).order_by(MediaAsset.created_at.desc())
    )
    assets = result.scalars().all()
    return [
        {
            "id": a.id,
            "url": f"/api/media/{a.id}",
            "kind": a.kind,
            "mime_type": a.mime_type,
            "bytes_size": a.bytes_size,
            "filename": os.path.basename(a.local_path),
            "created_at": a.created_at.isoformat(),
        }
        for a in assets
    ]


@router.get("/_/stats")
async def media_stats(db: AsyncSession = Depends(get_db)) -> dict:
    """Aggregate storage usage. Path uses `_/stats` so it doesn't collide with
    the `/{media_id}` int route."""
    result = await db.execute(select(MediaAsset))
    assets = result.scalars().all()
    by_kind: dict[str, dict[str, int]] = {}
    total_bytes = 0
    total_count = 0
    for a in assets:
        size = a.bytes_size or 0
        kind = a.kind or "other"
        bucket = by_kind.setdefault(kind, {"count": 0, "bytes": 0})
        bucket["count"] += 1
        bucket["bytes"] += size
        total_bytes += size
        total_count += 1

    # Soft quota — the disk is the real limit; this is purely advisory for the
    # progress bar in the admin UI. 5 GiB is comfortable on a Pi 5 with a
    # modest microSD; bump if you have more storage.
    quota_bytes = 5 * 1024 * 1024 * 1024

    return {
        "total_bytes": total_bytes,
        "total_count": total_count,
        "quota_bytes": quota_bytes,
        "by_kind": by_kind,
    }


_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")
# 256 KiB chunks: large enough to keep syscalls cheap, small enough to start
# streaming bytes to the browser within a single TCP roundtrip.
_CHUNK_SIZE = 256 * 1024


async def _stream_range(path: Path, start: int, end: int) -> AsyncIterator[bytes]:
    """Yield bytes [start, end] inclusive from `path` in chunks."""
    remaining = end - start + 1
    with path.open("rb") as f:
        f.seek(start)
        while remaining > 0:
            chunk = f.read(min(_CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/{media_id}")
async def serve_media(media_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    asset = await db.get(MediaAsset, media_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Media not found")
    path = Path(asset.local_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    file_size = path.stat().st_size
    media_type = asset.mime_type or "application/octet-stream"
    range_header = request.headers.get("range") or request.headers.get("Range")

    # Range request → 206 Partial Content. Required for smooth video playback
    # and seeking; without it Chrome/Safari buffer the whole file before play.
    if range_header:
        m = _RANGE_RE.match(range_header)
        if m:
            start_str, end_str = m.group(1), m.group(2)
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            if start >= file_size or end >= file_size or start > end:
                raise HTTPException(
                    status_code=416,
                    detail="Requested range not satisfiable",
                    headers={"Content-Range": f"bytes */{file_size}"},
                )
            length = end - start + 1
            headers = {
                "Content-Range":  f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(length),
                "Cache-Control":  "public, max-age=86400",
            }
            return StreamingResponse(
                _stream_range(path, start, end),
                status_code=206,
                media_type=media_type,
                headers=headers,
            )

    # No range header → full file, but advertise byte-range support so the
    # browser knows it can seek with subsequent requests.
    return FileResponse(
        path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Accept-Ranges": "bytes",
        },
    )


@router.delete("/{media_id}")
async def delete_media(media_id: int, db: AsyncSession = Depends(get_db)):
    asset = await db.get(MediaAsset, media_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Media not found")
    path = Path(asset.local_path)
    if path.exists():
        path.unlink()
    await db.delete(asset)
    await db.commit()
    return {"status": "ok"}
