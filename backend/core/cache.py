"""
Optional Redis cache. All functions are no-ops when REDIS_URL is not configured
or when the Redis server is unreachable. The caller never needs to check.
"""
from typing import Optional

_client = None
_tried = False  # avoid hammering Redis on every request if it's unavailable


def _build_client():
    from core.config import settings

    if not settings.redis_enabled:
        return None
    try:
        import redis

        c = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        c.ping()
        return c
    except Exception:
        return None


def _get_client():
    global _client, _tried
    if _tried:
        return _client
    _tried = True
    _client = _build_client()
    return _client


def get_cached(key: str) -> Optional[str]:
    c = _get_client()
    if c is None:
        return None
    try:
        return c.get(key)
    except Exception:
        return None


def set_cached(key: str, value: str, ttl: int = 60) -> None:
    c = _get_client()
    if c is None:
        return
    try:
        c.set(key, value, ex=ttl)
    except Exception:
        pass


def invalidate(key: str) -> None:
    c = _get_client()
    if c is None:
        return
    try:
        c.delete(key)
    except Exception:
        pass
