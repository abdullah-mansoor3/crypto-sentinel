"""Simple in-memory cache for OHLCV and computed indicators.

This is intentionally lightweight: a process-local cache stored in a dict.
It provides get/set/has/clear helpers used by the technical route.
"""
from threading import Lock
from time import time

_cache = {}
_lock = Lock()


def set(key: str, value, ttl: int | None = None):
	"""Store a value in the cache with optional TTL (seconds)."""
	with _lock:
		_cache[key] = {"value": value, "ts": time(), "ttl": ttl}


def get(key: str):
	"""Return cached value or None if missing/expired."""
	with _lock:
		item = _cache.get(key)
		if not item:
			return None
		ttl = item.get("ttl")
		if ttl is not None and (time() - item.get("ts", 0)) > ttl:
			# expired
			del _cache[key]
			return None
		return item.get("value")


def has(key: str) -> bool:
	return get(key) is not None


def clear(key: str | None = None):
	"""Clear a specific key or the entire cache if key is None."""
	with _lock:
		if key is None:
			_cache.clear()
		else:
			_cache.pop(key, None)


def keys():
	with _lock:
		return list(_cache.keys())
