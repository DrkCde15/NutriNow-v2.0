import os
from contextlib import contextmanager
from threading import Lock

import mysql.connector
from mysql.connector import pooling

_pool = None
_pool_config_key = None
_pool_lock = Lock()


def _db_config():
    return {
        "host": os.getenv("MYSQL_HOST"),
        "port": int(os.getenv("MYSQL_PORT", 3306)),
        "user": os.getenv("MYSQL_USER"),
        "password": os.getenv("MYSQL_PASSWORD"),
        "database": os.getenv("MYSQL_DATABASE"),
    }


def _get_pool():
    global _pool, _pool_config_key

    config = _db_config()
    config_key = tuple(sorted(config.items()))
    with _pool_lock:
        if _pool is None or _pool_config_key != config_key:
            _pool = pooling.MySQLConnectionPool(
                pool_name=os.getenv("MYSQL_POOL_NAME", "nutrinow_pool"),
                pool_size=int(os.getenv("MYSQL_POOL_SIZE", "5")),
                pool_reset_session=True,
                **config,
            )
            _pool_config_key = config_key

    return _pool

def get_db_connection():
    if os.getenv("MYSQL_DISABLE_POOL", "").strip().lower() in {"1", "true", "yes", "on"}:
        return mysql.connector.connect(**_db_config())
    return _get_pool().get_connection()

@contextmanager
def get_db():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor, conn
    except Exception:
        if conn.is_connected():
            conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
