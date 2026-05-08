from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import HTTPException, status

_LOCK = Lock()
_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def enforce_limit(*, key: str, limit: int, window_seconds: int) -> None:
    now = time()
    threshold = now - window_seconds
    with _LOCK:
        q = _BUCKETS[key]
        while q and q[0] <= threshold:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas tentativas. Tente novamente em instantes.",
            )
        q.append(now)


def reset_all() -> None:
    with _LOCK:
        _BUCKETS.clear()


def reset_key(key: str) -> None:
    with _LOCK:
        _BUCKETS.pop(key, None)
