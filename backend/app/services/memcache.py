"""In-RAM TTL cache with single-flight coalescing.

Hot endpoints (display bundle, sensor readings, resolution) are read far more
often than they change. Keeping their results in process memory avoids repeated
DB round-trips and disk I/O — for the kiosk loop this is the difference between
~10ms and sub-millisecond responses.

Single-flight: when many concurrent requests miss the cache for the same key,
only one runs the loader; the others await its result. Prevents thundering-herd
DB hits when many displays poll at once.
"""

from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, Generic, Hashable, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    __slots__ = ("_ttl", "_store", "_locks", "_lock")

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._store: dict[Hashable, tuple[float, T]] = {}
        self._locks: dict[Hashable, asyncio.Lock] = {}
        self._lock = asyncio.Lock()

    def get(self, key: Hashable) -> T | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: Hashable, value: T) -> None:
        self._store[key] = (time.monotonic() + self._ttl, value)

    def invalidate(self, key: Hashable | None = None) -> None:
        if key is None:
            self._store.clear()
        else:
            self._store.pop(key, None)

    async def get_or_load(self, key: Hashable, loader: Callable[[], Awaitable[T]]) -> T:
        cached = self.get(key)
        if cached is not None:
            return cached

        # Per-key lock guarantees only one loader runs for a given key.
        async with self._lock:
            lock = self._locks.setdefault(key, asyncio.Lock())

        async with lock:
            cached = self.get(key)
            if cached is not None:
                return cached
            value = await loader()
            self.set(key, value)
            return value


# Module-level caches — short TTLs trade tiny staleness for big throughput.
display_bundle_cache: TTLCache = TTLCache(ttl_seconds=3.0)
