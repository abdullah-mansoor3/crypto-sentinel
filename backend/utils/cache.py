"""Simple in-memory cache for OHLCV and computed indicators.

This is intentionally lightweight: a process-local cache stored in a dict.
It provides get/set/has/clear helpers used by the technical route.
"""
from threading import Lock
from time import time
import os
import json
import hashlib
from typing import Any

_cache = {}
_lock = Lock()

# disk cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)


def _safe_filename(key: str) -> str:
	h = hashlib.sha256(key.encode()).hexdigest()
	return os.path.join(CACHE_DIR, f"{h}.json")


def set(key: str, value, ttl: int | None = None):
	"""Store a value in the cache with optional TTL (seconds)."""
	with _lock:
		_cache[key] = {"value": value, "ts": time(), "ttl": ttl}
	# also persist to disk (best-effort)
	try:
		fp = _safe_filename(key)
		meta = {"value": value, "ts": time(), "ttl": ttl}
		tmp_fp = fp + ".tmp"
		with open(tmp_fp, "w") as fh:
			json.dump(meta, fh, default=str)
		# atomic replace
		try:
			os.replace(tmp_fp, fp)
		except Exception:
			# best-effort: if replace fails, try rename
			try:
				os.rename(tmp_fp, fp)
			except Exception:
				pass
	except Exception:
		# if value not JSON-serializable or write fails, ignore
		pass


def get(key: str):
	"""Return cached value or None if missing/expired."""
	with _lock:
		item = _cache.get(key)
		if not item:
			# try disk
			try:
				fp = _safe_filename(key)
				if not os.path.exists(fp):
					return None
				with open(fp, "r") as fh:
					disk = json.load(fh)
				ttl = disk.get("ttl")
				ts = disk.get("ts", 0)
				if ttl is not None and (time() - ts) > ttl:
					try:
						os.remove(fp)
					except Exception:
						pass
					return None
				return disk.get("value")
			except Exception:
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
			# clear disk cache
			try:
				for fn in os.listdir(CACHE_DIR):
					if fn.endswith('.json'):
						try:
							os.remove(os.path.join(CACHE_DIR, fn))
						except Exception:
							pass
			except Exception:
				pass
		else:
			_cache.pop(key, None)
			# remove disk file
			try:
				fp = _safe_filename(key)
				if os.path.exists(fp):
					os.remove(fp)
			except Exception:
				pass


def keys():
	with _lock:
		return list(_cache.keys())
