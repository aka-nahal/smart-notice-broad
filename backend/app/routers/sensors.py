"""
Sensor integration for Raspberry Pi GPIO.

On a real RPi with gpiozero / Adafruit_DHT installed the live readings are used.
On any other platform (or when the libraries are absent) mock data is returned so
the rest of the stack can be developed and tested without hardware.
"""

import random
from datetime import datetime

from fastapi import APIRouter, HTTPException

router = APIRouter()

# ── GPIO availability detection ──────────────────────────────────────────────
_gpio_available = False
_dht_available = False

try:
    import gpiozero  # noqa: F401
    _gpio_available = True
except ImportError:
    pass

try:
    import Adafruit_DHT  # noqa: F401
    _dht_available = True
except ImportError:
    pass

# ── In-memory cache of last real readings (populated by a background task) ───
_cache: dict[str, dict] = {}

# Supported sensor types and their metadata
SENSOR_META = {
    "temperature": {"label": "Temperature", "unit": "°C", "icon": "🌡️"},
    "humidity":    {"label": "Humidity",    "unit": "%",  "icon": "💧"},
    "motion":      {"label": "Motion",      "unit": "",   "icon": "👁️"},
    "light":       {"label": "Light Level", "unit": "lux","icon": "☀️"},
}

# ── Mock data generator ───────────────────────────────────────────────────────
def _mock_reading(sensor_type: str) -> dict:
    base = {
        "temperature": round(22.5 + random.uniform(-3, 3), 1),
        "humidity":    round(55   + random.uniform(-8, 8), 1),
        "motion":      random.choice([True, False]),
        "light":       round(420  + random.uniform(-80, 80), 0),
    }
    if sensor_type not in base:
        raise HTTPException(status_code=404, detail=f"Unknown sensor: {sensor_type}")
    meta = SENSOR_META[sensor_type]
    return {
        "sensor":    sensor_type,
        "value":     base[sensor_type],
        "unit":      meta["unit"],
        "label":     meta["label"],
        "icon":      meta["icon"],
        "mock":      True,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def sensor_status() -> dict:
    """Return GPIO availability and which sensors have cached readings."""
    return {
        "gpio_available":  _gpio_available,
        "dht_available":   _dht_available,
        "mock_mode":       not _gpio_available,
        "cached_sensors":  list(_cache.keys()),
        "supported":       list(SENSOR_META.keys()),
    }


@router.get("/readings")
async def all_readings() -> dict:
    """Return readings for all supported sensors."""
    return {
        sensor_type: (_cache.get(sensor_type) or _mock_reading(sensor_type))
        for sensor_type in SENSOR_META
    }


@router.get("/readings/{sensor_type}")
async def single_reading(sensor_type: str) -> dict:
    """Return the latest reading for one sensor type."""
    if sensor_type not in SENSOR_META:
        raise HTTPException(status_code=404, detail=f"Unknown sensor: {sensor_type}")
    if sensor_type in _cache:
        return _cache[sensor_type]
    return _mock_reading(sensor_type)
