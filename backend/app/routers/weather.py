"""Proxy endpoints for the OpenWeather API.

Keeps the API key server-side and shapes the upstream JSON into the compact
payload the display widget needs. Upstream errors are surfaced intact so a
bad key / unknown city / rate-limit produces a helpful message in the UI
instead of a generic "API error".

Setup
-----
1. Get a free key from https://openweathermap.org/api (activation can take
   up to a couple of hours on a new account).
2. Put it in ``backend/.env``:
       OPENWEATHER_API_KEY=your-key-here
3. Restart the backend.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter()

OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"
REQUEST_TIMEOUT = 8.0

# Small in-process TTL cache. The widget refreshes every 10 min per tile, but
# several tiles / several displays can share a single upstream hit. Keyed by
# (endpoint, city, units).
_CACHE: dict[tuple[str, str, str], tuple[float, dict]] = {}
_CACHE_TTL = 120.0  # seconds


def _cache_get(key: tuple[str, str, str]) -> dict | None:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() >= expires_at:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: tuple[str, str, str], value: dict) -> None:
    _CACHE[key] = (time.monotonic() + _CACHE_TTL, value)


def _require_api_key() -> str:
    key = settings.openweather_api_key
    if not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "OpenWeather API key not configured. Add OPENWEATHER_API_KEY "
                "to backend/.env and restart the backend."
            ),
        )
    return key


def _upstream_message(resp: httpx.Response) -> str:
    """Pull OpenWeather's own error message if present, else a short summary."""
    try:
        body = resp.json()
        msg = body.get("message") if isinstance(body, dict) else None
        if msg:
            return str(msg)
    except Exception:
        pass
    return f"HTTP {resp.status_code} from OpenWeather"


async def _call_openweather(path: str, params: dict[str, Any]) -> dict:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(f"{OPENWEATHER_BASE}{path}", params=params)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OpenWeather request timed out")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach OpenWeather: {e}")

    if resp.status_code == 200:
        return resp.json()

    # Surface the real upstream message so the UI shows "Invalid API key",
    # "city not found", "rate limit exceeded", etc.
    msg = _upstream_message(resp)
    if resp.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail=f"OpenWeather rejected the API key ({msg}). "
                   "New keys can take up to 2 hours to activate.",
        )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail=msg or "City not found")
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail=f"OpenWeather rate limit: {msg}")
    raise HTTPException(status_code=502, detail=msg)


def _shape_current(data: dict, fallback_city: str) -> dict:
    main = data.get("main") or {}
    wind = data.get("wind") or {}
    weather = (data.get("weather") or [{}])[0]
    icon = weather.get("icon") or "01d"
    return {
        "city":         data.get("name") or fallback_city,
        "country":      (data.get("sys") or {}).get("country", ""),
        "temp":         main.get("temp", 0),
        "feels_like":   main.get("feels_like", 0),
        "temp_min":     main.get("temp_min", 0),
        "temp_max":     main.get("temp_max", 0),
        "humidity":     main.get("humidity", 0),
        "pressure":     main.get("pressure", 0),
        "wind_speed":   wind.get("speed", 0),
        "wind_deg":     wind.get("deg", 0),
        "description":  weather.get("description", ""),
        "icon":         icon,
        "icon_url":     f"https://openweathermap.org/img/wn/{icon}@2x.png",
        "visibility":   data.get("visibility", 0),
        "clouds":       (data.get("clouds") or {}).get("all", 0),
        "dt":           data.get("dt", 0),
        "timezone":     data.get("timezone", 0),
    }


def _shape_forecast(data: dict, fallback_city: str) -> dict:
    city_meta = data.get("city") or {}
    items = []
    for item in data.get("list") or []:
        main = item.get("main") or {}
        weather = (item.get("weather") or [{}])[0]
        icon = weather.get("icon") or "01d"
        items.append({
            "dt":          item.get("dt", 0),
            "temp":        main.get("temp", 0),
            "description": weather.get("description", ""),
            "icon":        icon,
            "icon_url":    f"https://openweathermap.org/img/wn/{icon}@2x.png",
        })
    return {
        "city":    city_meta.get("name") or fallback_city,
        "country": city_meta.get("country", ""),
        "items":   items,
    }


@router.get("/current")
async def get_current_weather(
    city: str = Query(default="London", min_length=1),
    units: str = Query(default="metric", pattern="^(metric|imperial|standard)$"),
):
    api_key = _require_api_key()
    cache_key = ("current", city.lower(), units)
    if (hit := _cache_get(cache_key)) is not None:
        return hit
    data = await _call_openweather("/weather", {"q": city, "units": units, "appid": api_key})
    shaped = _shape_current(data, city)
    _cache_set(cache_key, shaped)
    return shaped


@router.get("/forecast")
async def get_forecast(
    city: str = Query(default="London", min_length=1),
    units: str = Query(default="metric", pattern="^(metric|imperial|standard)$"),
):
    api_key = _require_api_key()
    cache_key = ("forecast", city.lower(), units)
    if (hit := _cache_get(cache_key)) is not None:
        return hit
    data = await _call_openweather(
        "/forecast",
        {"q": city, "units": units, "appid": api_key, "cnt": 8},
    )
    shaped = _shape_forecast(data, city)
    _cache_set(cache_key, shaped)
    return shaped
