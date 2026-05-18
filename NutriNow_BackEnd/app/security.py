import logging
import os
import re
import time
from collections import defaultdict, deque
from threading import Lock
from urllib.parse import urlparse

from flask import jsonify, request

logger = logging.getLogger(__name__)

DEPLOYED_FRONTEND_ORIGINS = [
    "https://nutrinow-app.jcesarsantana215.workers.dev",
]

LOCAL_FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TRUTHY_VALUES = {"1", "true", "yes", "on"}
COMMON_PASSWORDS = {
    "1234567890",
    "123456789",
    "password",
    "senha123",
    "qwerty123",
    "nutrinow123",
}

_rate_limit_buckets = defaultdict(deque)
_rate_limit_lock = Lock()


def env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUTHY_VALUES


def app_environment():
    return (os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or os.getenv("ENV") or "development").strip().lower()


def is_development():
    return app_environment() in {"dev", "development", "local", "test", "testing"}


def normalize_origin(value):
    candidate = (value or "").strip().rstrip("/")
    if not candidate or candidate == "*":
        return None

    parsed = urlparse(candidate)
    if not parsed.scheme or not parsed.netloc:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None

    return f"{parsed.scheme}://{parsed.netloc}"


def _active_origin_env_names():
    env_names = (
        ["FRONTEND_URL_DEV", "CORS_ORIGIN_DEV", "CORS_ORIGINS_DEV"]
        if is_development()
        else ["FRONTEND_URL_PROD", "CORS_ORIGIN_PROD", "CORS_ORIGINS_PROD"]
    )

    if any(os.getenv(name) for name in env_names):
        return env_names

    return ["FRONTEND_URL", "CORS_ORIGIN", "CORS_ORIGINS"]


def _configured_origin_values():
    for name in _active_origin_env_names():
        raw = os.getenv(name, "")
        for item in raw.split(","):
            yield item.strip()


def _configured_origins():
    for item in _configured_origin_values():
        origin = normalize_origin(item)
        if origin:
            yield origin


def _configured_frontend_url():
    env_names = (
        ["FRONTEND_URL_DEV", "CORS_ORIGIN_DEV"]
        if is_development()
        else ["FRONTEND_URL_PROD", "CORS_ORIGIN_PROD"]
    )

    for name in [*env_names, "FRONTEND_URL", "CORS_ORIGIN"]:
        item = os.getenv(name, "")
        origin = normalize_origin(item)
        if origin:
            return origin

    return LOCAL_FRONTEND_ORIGINS[0] if is_development() else DEPLOYED_FRONTEND_ORIGINS[0]


def build_allowed_origins(include_local=None):
    if include_local is None:
        include_local = is_development()

    if "*" in set(_configured_origin_values()):
        raise RuntimeError("Variaveis de CORS nao podem usar '*'")

    origins = []
    for origin in DEPLOYED_FRONTEND_ORIGINS:
        origins.append(origin)

    if include_local:
        origins.extend(LOCAL_FRONTEND_ORIGINS)

    origins.extend(_configured_origins())

    unique_origins = []
    for origin in origins:
        normalized = normalize_origin(origin)
        if normalized and normalized not in unique_origins:
            unique_origins.append(normalized)

    if not unique_origins:
        raise RuntimeError("Nenhuma origem de frontend foi configurada")

    return unique_origins


def get_request_origin():
    return normalize_origin(request.headers.get("Origin") or request.referrer)


def select_frontend_origin(candidate=None, strict=False):
    allowed_origins = build_allowed_origins()
    origin = normalize_origin(candidate)

    if origin and origin in allowed_origins:
        return origin

    fallback = normalize_origin(_configured_frontend_url()) or allowed_origins[0]
    if strict and origin:
        raise ValueError("Origem de frontend nao permitida")

    return fallback


def normalize_email(value):
    return str(value or "").strip().lower()


def validate_email(value):
    email = normalize_email(value)
    if not email or len(email) > 255 or not EMAIL_RE.match(email):
        return None
    return email


def validate_password(value):
    password = str(value or "")
    if len(password) < 10:
        return "Senha deve ter ao menos 10 caracteres"
    if password.lower() in COMMON_PASSWORDS:
        return "Use uma senha menos comum"
    return None


def _client_ip():
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.remote_addr or "unknown"


def check_rate_limit(scope, limit, window_seconds, *parts):
    now = time.monotonic()
    key_parts = [scope, _client_ip(), *(str(part or "").strip().lower() for part in parts if part)]
    key = ":".join(key_parts)

    with _rate_limit_lock:
        bucket = _rate_limit_buckets[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            return False, retry_after

        bucket.append(now)
        return True, None


def rate_limit_response(retry_after=None):
    response = jsonify({"error": "Muitas tentativas. Tente novamente em instantes."})
    if retry_after:
        response.headers["Retry-After"] = str(retry_after)
    return response, 429
