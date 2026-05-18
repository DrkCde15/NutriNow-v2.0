import re
import time
from threading import Lock

TABLE_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")
SCHEMA_CACHE_SECONDS = 10 * 60
DIETA_TREINO_SCHEDULE_COLUMNS = {
    "duration_minutes": "ALTER TABLE dieta_treino ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60",
    "recurrence_type": "ALTER TABLE dieta_treino ADD COLUMN recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none'",
    "recurrence_days": "ALTER TABLE dieta_treino ADD COLUMN recurrence_days VARCHAR(32) NULL",
    "recurrence_until": "ALTER TABLE dieta_treino ADD COLUMN recurrence_until DATE NULL",
}

_table_columns_cache = {}
_cache_lock = Lock()


def _normalize_column_name(row):
    return row.get("column_name") or row.get("COLUMN_NAME")


def get_table_columns(cursor, table_name):
    if not TABLE_NAME_RE.match(table_name or ""):
        raise ValueError("Nome de tabela invalido")

    now = time.monotonic()
    with _cache_lock:
        cached = _table_columns_cache.get(table_name)
        if cached and cached["expires_at"] > now:
            return set(cached["columns"])

    cursor.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = %s
        """,
        (table_name,),
    )
    columns = {_normalize_column_name(row) for row in cursor.fetchall()}
    columns.discard(None)

    with _cache_lock:
        _table_columns_cache[table_name] = {
            "columns": set(columns),
            "expires_at": now + SCHEMA_CACHE_SECONDS,
        }

    return columns


def invalidate_table_columns(table_name):
    with _cache_lock:
        _table_columns_cache.pop(table_name, None)


def resolve_dieta_user_column(cursor):
    columns = get_table_columns(cursor, "dieta_treino")
    if "user_id" in columns:
        return "user_id"
    if "usuario_id" in columns:
        return "usuario_id"
    return "user_id"


def ensure_dieta_treino_schedule_columns(cursor):
    columns = get_table_columns(cursor, "dieta_treino")
    missing_columns = [
        column
        for column in DIETA_TREINO_SCHEDULE_COLUMNS
        if column not in columns
    ]
    if not missing_columns:
        return

    for column in missing_columns:
        cursor.execute(DIETA_TREINO_SCHEDULE_COLUMNS[column])

    invalidate_table_columns("dieta_treino")
