import mysql.connector
import os
from contextlib import contextmanager
from flask import current_app

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        user=os.getenv('MYSQL_USER', 'root'),
        password=os.getenv('MYSQL_PASSWORD', ''),
        database=os.getenv('MYSQL_DATABASE', 'nutrinow2')
    )

@contextmanager
def get_db():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield cursor, conn
    finally:
        cursor.close()
        conn.close()
