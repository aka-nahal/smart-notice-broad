import json
import re
from typing import Any

import httpx

from app.config import settings
from app.schemas.ai import NoticeDraftFromAI


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("No JSON object in model response")
    return json.loads(m.group(0))


async def draft_notice_from_raw_input(*, raw_text: str, locale: str = "en") -> NoticeDraftFromAI:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not configured")

    prompt = f"""You are a school/campus notice assistant. Given raw admin input, produce a structured notice.
Locale hint: {locale}

Return ONLY valid JSON with keys:
title (string), summary (string, one line), formatted_body (string, markdown), priority_level (integer 0-100),
suggested_category (string or null), suggested_tags (array of strings, max 8).

Raw input:
{raw_text}
"""

    url = GEMINI_URL.format(model=settings.gemini_model)
    params = {"key": settings.gemini_api_key}
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, params=params, json=body)
        r.raise_for_status()
        data = r.json()

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError("Empty Gemini response")
    text = parts[0].get("text", "")
    obj = _extract_json_object(text)
    return NoticeDraftFromAI.model_validate(obj)
