from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import time
from typing import TYPE_CHECKING

from fastapi import HTTPException, status

from app.core.config import get_settings

if TYPE_CHECKING:
    from redis import Redis

_LOCK = Lock()
_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_REDIS_CLIENT: Redis | None = None
_REDIS_UNAVAILABLE = False


def _get_redis_client() -> Redis | None:
    global _REDIS_CLIENT, _REDIS_UNAVAILABLE
    if _REDIS_UNAVAILABLE:
        return None
    settings = get_settings()
    if not settings.redis_url:
        return None
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    try:
        import redis

        _REDIS_CLIENT = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception:
        _REDIS_UNAVAILABLE = True
        _REDIS_CLIENT = None
        return None


def _enforce_memory(*, key: str, limit: int, window_seconds: int) -> None:
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


def _enforce_redis(*, client: Redis, key: str, limit: int, window_seconds: int) -> None:
    redis_key = f"bolao:ratelimit:{key}"
    count = client.incr(redis_key)
    if count == 1:
        client.expire(redis_key, window_seconds)
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Tente novamente em instantes.",
        )


def enforce_limit(*, key: str, limit: int, window_seconds: int) -> None:
    client = _get_redis_client()
    if client is not None:
        try:
            _enforce_redis(client=client, key=key, limit=limit, window_seconds=window_seconds)
            return
        except HTTPException:
            raise
        except Exception:
            pass
    _enforce_memory(key=key, limit=limit, window_seconds=window_seconds)


def reset_all() -> None:
    with _LOCK:
        _BUCKETS.clear()
    client = _get_redis_client()
    if client is not None:
        try:
            for redis_key in client.scan_iter("bolao:ratelimit:*"):
                client.delete(redis_key)
        except Exception:
            pass


def reset_key(key: str) -> None:
    with _LOCK:
        _BUCKETS.pop(key, None)
    client = _get_redis_client()
    if client is not None:
        try:
            client.delete(f"bolao:ratelimit:{key}")
        except Exception:
            pass
