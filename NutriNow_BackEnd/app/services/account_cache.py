import os
import time
from threading import Lock

_cache = {}
_cache_lock = Lock()


def _ttl_seconds():
    return int(os.getenv("USER_ACCOUNT_CACHE_SECONDS", "20"))


def get_cached_account(user_id):
    key = str(user_id)
    now = time.monotonic()

    with _cache_lock:
        entry = _cache.get(key)
        if not entry:
            return None

        if entry["expires_at"] <= now:
            _cache.pop(key, None)
            return None

        return dict(entry["value"])


def set_cached_account(user_id, account):
    ttl = _ttl_seconds()
    if ttl <= 0:
        return

    with _cache_lock:
        _cache[str(user_id)] = {
            "expires_at": time.monotonic() + ttl,
            "value": dict(account),
        }


def invalidate_cached_account(user_id):
    with _cache_lock:
        _cache.pop(str(user_id), None)
