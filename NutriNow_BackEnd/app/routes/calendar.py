import logging
import os
import re
from datetime import date, datetime, timedelta
from urllib.parse import quote, urlencode

import requests
from flask import Blueprint, current_app, jsonify, redirect, request, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.database import get_db
from app.routes.auth import get_google_oauth_hosts
from app.security import select_frontend_origin

logger = logging.getLogger(__name__)
google_calendar_bp = Blueprint("google_calendar", __name__)

GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GOOGLE_CALENDAR_STATE_SALT = "nutrinow-google-calendar-oauth"
TOKEN_EXPIRY_LEEWAY_SECONDS = 60
DEFAULT_CALENDAR_ID = "primary"
WEEKDAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

CREATE_GOOGLE_CALENDAR_TOKENS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    user_id INT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    token_type VARCHAR(40) DEFAULT 'Bearer',
    scope TEXT NULL,
    expires_at DATETIME NULL,
    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_google_calendar_tokens_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

CREATE_GOOGLE_CALENDAR_EVENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS google_calendar_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    dieta_treino_id BIGINT NOT NULL,
    tipo ENUM('treino', 'dieta') NOT NULL,
    google_event_id VARCHAR(255) NOT NULL,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_calendar_event_item (user_id, dieta_treino_id, tipo),
    INDEX idx_google_calendar_events_user (user_id),
    CONSTRAINT fk_google_calendar_events_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


class GoogleCalendarError(Exception):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


def _ensure_google_calendar_tables(cursor):
    cursor.execute(CREATE_GOOGLE_CALENDAR_TOKENS_TABLE_SQL)
    cursor.execute(CREATE_GOOGLE_CALENDAR_EVENTS_TABLE_SQL)


def _get_google_client_config():
    client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("SECRET_KEY_CLIENT")

    if not client_id or not client_secret:
        raise GoogleCalendarError("Credenciais OAuth do Google nao configuradas", 500)

    return client_id, client_secret


def _get_state_serializer():
    secret = (
        current_app.secret_key
        or current_app.config.get("JWT_SECRET_KEY")
        or os.getenv("JWT_SECRET_KEY")
        or os.getenv("FLASK_SECRET_KEY")
    )
    if not secret:
        raise GoogleCalendarError("Chave de assinatura do app nao configurada", 500)
    return URLSafeTimedSerializer(secret)


def _normalize_frontend_origin(value=None):
    return select_frontend_origin(value)


def _get_frontend_origin():
    return _normalize_frontend_origin(request.headers.get("Origin") or request.referrer)


def _calendar_redirect_uri():
    configured = os.getenv("GOOGLE_CALENDAR_REDIRECT_URI")
    if configured:
        return configured.strip()
    return url_for("google_calendar.google_calendar_callback", _external=True)


def _frontend_redirect(origin, status):
    query = urlencode({"google_calendar": status})
    return f"{_normalize_frontend_origin(origin)}/calendario?{query}"


def _request_google_token(payload):
    hosts = get_google_oauth_hosts()
    response = requests.post(hosts.token_endpoint, data=payload, timeout=20)

    if response.ok:
        return response.json()

    try:
        error_payload = response.json()
        message = error_payload.get("error_description") or error_payload.get("error") or response.text
    except ValueError:
        message = response.text

    raise GoogleCalendarError(f"Google OAuth recusou a solicitacao: {message}", response.status_code)


def _build_authorization_url(user_id, origin):
    client_id, _ = _get_google_client_config()
    state = _get_state_serializer().dumps(
        {"user_id": str(user_id), "origin": _normalize_frontend_origin(origin)},
        salt=GOOGLE_CALENDAR_STATE_SALT,
    )

    hosts = get_google_oauth_hosts()
    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": _calendar_redirect_uri(),
            "response_type": "code",
            "scope": GOOGLE_CALENDAR_SCOPE,
            "state": state,
            "access_type": "offline",
            "include_granted_scopes": "true",
            "prompt": "consent",
        }
    )
    return f"{hosts.authorization_endpoint}?{params}"


def _to_datetime(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
            return parsed.replace(tzinfo=None)
        except ValueError:
            pass

        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    return datetime.now()


def _expires_at_from_payload(payload):
    expires_in = int(payload.get("expires_in") or 3600)
    return datetime.utcnow() + timedelta(seconds=expires_in)


def _save_token_payload(cursor, user_id, payload, existing_refresh_token=None, calendar_id=DEFAULT_CALENDAR_ID):
    refresh_token = payload.get("refresh_token") or existing_refresh_token
    token_type = payload.get("token_type") or "Bearer"
    scope = payload.get("scope") or GOOGLE_CALENDAR_SCOPE
    expires_at = _expires_at_from_payload(payload)

    cursor.execute(
        """
        INSERT INTO google_calendar_tokens
            (user_id, access_token, refresh_token, token_type, scope, expires_at, calendar_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            access_token = VALUES(access_token),
            refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
            token_type = VALUES(token_type),
            scope = VALUES(scope),
            expires_at = VALUES(expires_at),
            calendar_id = VALUES(calendar_id),
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            user_id,
            payload["access_token"],
            refresh_token,
            token_type,
            scope,
            expires_at,
            calendar_id or DEFAULT_CALENDAR_ID,
        ),
    )


def _get_token_record(cursor, user_id):
    cursor.execute(
        """
        SELECT user_id, access_token, refresh_token, token_type, scope, expires_at, calendar_id, updated_at
        FROM google_calendar_tokens
        WHERE user_id=%s
        """,
        (user_id,),
    )
    return cursor.fetchone()


def _get_valid_access_token(cursor, conn, user_id):
    record = _get_token_record(cursor, user_id)
    if not record:
        raise GoogleCalendarError("Google Calendar ainda nao conectado", 409)

    expires_at = _to_datetime(record.get("expires_at"))
    if expires_at > datetime.utcnow() + timedelta(seconds=TOKEN_EXPIRY_LEEWAY_SECONDS):
        return record["access_token"], record

    refresh_token = record.get("refresh_token")
    if not refresh_token:
        raise GoogleCalendarError("Conecte novamente o Google Calendar para renovar a permissao", 409)

    client_id, client_secret = _get_google_client_config()
    payload = _request_google_token(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    )

    _save_token_payload(
        cursor,
        user_id,
        payload,
        existing_refresh_token=refresh_token,
        calendar_id=record.get("calendar_id") or DEFAULT_CALENDAR_ID,
    )
    conn.commit()

    refreshed = _get_token_record(cursor, user_id)
    return payload["access_token"], refreshed


def _resolve_dieta_user_column(cursor):
    try:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'dieta_treino'
              AND column_name IN ('user_id', 'usuario_id')
            """
        )
        columns = {
            row.get("column_name") or row.get("COLUMN_NAME")
            for row in cursor.fetchall()
        }
        if "user_id" in columns:
            return "user_id"
        if "usuario_id" in columns:
            return "usuario_id"
    except Exception as exc:
        logger.warning(f"Nao foi possivel detectar coluna de usuario em dieta_treino: {exc}")
    return "user_id"


def _ensure_dieta_treino_schedule_columns(cursor):
    cursor.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'dieta_treino'
        """
    )
    columns = {
        row.get("column_name") or row.get("COLUMN_NAME")
        for row in cursor.fetchall()
    }

    if "duration_minutes" not in columns:
        cursor.execute("ALTER TABLE dieta_treino ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60")
    if "recurrence_type" not in columns:
        cursor.execute("ALTER TABLE dieta_treino ADD COLUMN recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none'")
    if "recurrence_days" not in columns:
        cursor.execute("ALTER TABLE dieta_treino ADD COLUMN recurrence_days VARCHAR(32) NULL")
    if "recurrence_until" not in columns:
        cursor.execute("ALTER TABLE dieta_treino ADD COLUMN recurrence_until DATE NULL")


def _fetch_local_calendar_items(cursor, user_id):
    _ensure_dieta_treino_schedule_columns(cursor)
    user_column = _resolve_dieta_user_column(cursor)
    cursor.execute(
        f"""
        SELECT
            id,
            tipo,
            title,
            description,
            time,
            created_at,
            updated_at,
            duration_minutes,
            recurrence_type,
            recurrence_days,
            DATE_FORMAT(recurrence_until, '%Y-%m-%d') AS recurrence_until
        FROM dieta_treino
        WHERE {user_column}=%s
        ORDER BY created_at ASC
        """,
        (user_id,),
    )
    return cursor.fetchall() or []


def _item_start_datetime(item):
    start = _to_datetime(item.get("created_at"))
    time_value = str(item.get("time") or "").strip()

    if re.fullmatch(r"\d{2}:\d{2}", time_value):
        hours, minutes = [int(part) for part in time_value.split(":")]
        start = start.replace(hour=hours, minute=minutes, second=0, microsecond=0)

    return start


def _format_recurrence_until(value):
    if not value:
        return None

    if isinstance(value, datetime):
        until_date = value.date()
    elif isinstance(value, date):
        until_date = value
    else:
        try:
            until_date = datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
        except ValueError:
            return None

    return until_date.strftime("%Y%m%dT235959Z")


def _parse_recurrence_days(value):
    days = []
    for part in str(value or "").split(","):
        day = part.strip().upper()
        if day in WEEKDAY_ORDER and day not in days:
            days.append(day)
    return days


def _build_google_event(item, user_id):
    tipo = (item.get("tipo") or "").lower()
    tipo_label = "Treino" if tipo == "treino" else "Dieta"
    timezone = os.getenv("GOOGLE_CALENDAR_TIMEZONE", "America/Sao_Paulo")
    duration_minutes = int(item.get("duration_minutes") or os.getenv("GOOGLE_CALENDAR_EVENT_DURATION_MINUTES", "60"))
    start = _item_start_datetime(item)
    end = start + timedelta(minutes=duration_minutes)
    description = " ".join(str(item.get("description") or "").split())

    event = {
        "summary": f"NutriNow - {tipo_label}: {item.get('title')}",
        "description": description,
        "start": {
            "dateTime": start.strftime("%Y-%m-%dT%H:%M:%S"),
            "timeZone": timezone,
        },
        "end": {
            "dateTime": end.strftime("%Y-%m-%dT%H:%M:%S"),
            "timeZone": timezone,
        },
        "extendedProperties": {
            "private": {
                "nutrinow_item_id": str(item.get("id")),
                "nutrinow_item_type": tipo,
                "nutrinow_user_id": str(user_id),
                "nutrinow_recurrence_type": str(item.get("recurrence_type") or "none"),
            }
        },
        "reminders": {"useDefault": True},
    }

    recurrence_type = str(item.get("recurrence_type") or "none").lower()
    recurrence_days = _parse_recurrence_days(item.get("recurrence_days"))
    if recurrence_type == "weekly" and recurrence_days:
        rule = f"RRULE:FREQ=WEEKLY;BYDAY={','.join(recurrence_days)}"
        until = _format_recurrence_until(item.get("recurrence_until"))
        if until:
            rule = f"{rule};UNTIL={until}"
        event["recurrence"] = [rule]

    return event


def _google_calendar_request(method, path, access_token, payload=None, params=None):
    url = f"https://www.googleapis.com/calendar/v3/{path.lstrip('/')}"
    response = requests.request(
        method,
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=payload,
        params=params,
        timeout=20,
    )

    if response.ok:
        if response.status_code == 204:
            return {}
        return response.json()

    try:
        error_payload = response.json()
        message = (
            error_payload.get("error", {}).get("message")
            if isinstance(error_payload.get("error"), dict)
            else None
        )
        message = message or response.text
    except ValueError:
        message = response.text

    raise GoogleCalendarError(message, response.status_code)


def _get_event_mapping(cursor, user_id, item):
    cursor.execute(
        """
        SELECT google_event_id
        FROM google_calendar_events
        WHERE user_id=%s AND dieta_treino_id=%s AND tipo=%s
        """,
        (user_id, item["id"], item["tipo"]),
    )
    return cursor.fetchone()


def _upsert_event_mapping(cursor, user_id, item, google_event_id):
    cursor.execute(
        """
        INSERT INTO google_calendar_events (user_id, dieta_treino_id, tipo, google_event_id, synced_at)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
            google_event_id = VALUES(google_event_id),
            synced_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        """,
        (user_id, item["id"], item["tipo"], google_event_id),
    )


def _sync_one_event(cursor, user_id, access_token, calendar_id, item):
    encoded_calendar_id = quote(calendar_id or DEFAULT_CALENDAR_ID, safe="")
    mapping = _get_event_mapping(cursor, user_id, item)
    event_body = _build_google_event(item, user_id)

    if mapping:
        encoded_event_id = quote(mapping["google_event_id"], safe="")
        try:
            event = _google_calendar_request(
                "PUT",
                f"/calendars/{encoded_calendar_id}/events/{encoded_event_id}",
                access_token,
                payload=event_body,
            )
            return "updated", event
        except GoogleCalendarError as exc:
            if exc.status_code != 404:
                raise

    event = _google_calendar_request(
        "POST",
        f"/calendars/{encoded_calendar_id}/events",
        access_token,
        payload=event_body,
    )
    _upsert_event_mapping(cursor, user_id, item, event["id"])
    return "created", event


def sync_google_calendar_item(user_id, item_id):
    try:
        with get_db() as (cursor, conn):
            _ensure_google_calendar_tables(cursor)
            access_token, token_record = _get_valid_access_token(cursor, conn, user_id)

            _ensure_dieta_treino_schedule_columns(cursor)
            user_column = _resolve_dieta_user_column(cursor)
            cursor.execute(
                f"""
                SELECT
                    id,
                    tipo,
                    title,
                    description,
                    time,
                    created_at,
                    updated_at,
                    duration_minutes,
                    recurrence_type,
                    recurrence_days,
                    DATE_FORMAT(recurrence_until, '%Y-%m-%d') AS recurrence_until
                FROM dieta_treino
                WHERE id=%s AND {user_column}=%s
                """,
                (item_id, user_id),
            )
            item = cursor.fetchone()
            if not item:
                return {"synced": False, "reason": "not_found"}

            calendar_id = token_record.get("calendar_id") or DEFAULT_CALENDAR_ID
            action, event = _sync_one_event(cursor, user_id, access_token, calendar_id, item)
            _upsert_event_mapping(cursor, user_id, item, event["id"])
            conn.commit()

            return {
                "synced": True,
                "action": action,
                "calendarId": calendar_id,
                "googleEventId": event["id"],
            }
    except GoogleCalendarError as exc:
        if exc.status_code == 409:
            return {"synced": False, "reason": "not_connected", "error": str(exc)}
        logger.warning(f"Falha na sincronizacao automatica do Google Calendar: {exc}")
        return {"synced": False, "reason": "google_error", "error": str(exc)}
    except Exception as exc:
        logger.error(f"Erro inesperado na sincronizacao automatica do Google Calendar: {exc}")
        return {"synced": False, "reason": "server_error"}


def delete_google_calendar_item(user_id, item_id, tipo=None):
    try:
        with get_db() as (cursor, conn):
            _ensure_google_calendar_tables(cursor)

            params = [user_id, item_id]
            tipo_filter = ""
            if tipo:
                tipo_filter = " AND tipo=%s"
                params.append(tipo)

            cursor.execute(
                f"""
                SELECT google_event_id, tipo
                FROM google_calendar_events
                WHERE user_id=%s AND dieta_treino_id=%s{tipo_filter}
                """,
                tuple(params),
            )
            mapping = cursor.fetchone()
            if not mapping:
                conn.commit()
                return {"deleted": False, "reason": "not_synced"}

            access_token, token_record = _get_valid_access_token(cursor, conn, user_id)
            calendar_id = token_record.get("calendar_id") or DEFAULT_CALENDAR_ID
            encoded_calendar_id = quote(calendar_id, safe="")
            encoded_event_id = quote(mapping["google_event_id"], safe="")

            try:
                _google_calendar_request(
                    "DELETE",
                    f"/calendars/{encoded_calendar_id}/events/{encoded_event_id}",
                    access_token,
                )
            except GoogleCalendarError as exc:
                if exc.status_code != 404:
                    raise

            cursor.execute(
                """
                DELETE FROM google_calendar_events
                WHERE user_id=%s AND dieta_treino_id=%s AND google_event_id=%s
                """,
                (user_id, item_id, mapping["google_event_id"]),
            )
            conn.commit()

            return {"deleted": True, "calendarId": calendar_id}
    except GoogleCalendarError as exc:
        if exc.status_code == 409:
            return {"deleted": False, "reason": "not_connected", "error": str(exc)}
        logger.warning(f"Falha ao remover evento do Google Calendar: {exc}")
        return {"deleted": False, "reason": "google_error", "error": str(exc)}
    except Exception as exc:
        logger.error(f"Erro inesperado ao remover evento do Google Calendar: {exc}")
        return {"deleted": False, "reason": "server_error"}


@google_calendar_bp.route("/calendar/google/status", methods=["GET"])
@jwt_required()
def google_calendar_status():
    user_id = get_jwt_identity()

    try:
        with get_db() as (cursor, conn):
            _ensure_google_calendar_tables(cursor)
            record = _get_token_record(cursor, user_id)
            conn.commit()

        if not record:
            return jsonify({"connected": False}), 200

        expires_at = _to_datetime(record.get("expires_at"))
        needs_reconnect = not record.get("refresh_token") and expires_at <= datetime.utcnow()

        return (
            jsonify(
                {
                    "connected": True,
                    "calendarId": record.get("calendar_id") or DEFAULT_CALENDAR_ID,
                    "expiresAt": expires_at.isoformat(),
                    "needsReconnect": needs_reconnect,
                }
            ),
            200,
        )
    except GoogleCalendarError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    except Exception as exc:
        logger.error(f"Erro ao buscar status do Google Calendar: {exc}")
        return jsonify({"error": "Falha ao buscar status do Google Calendar"}), 500


@google_calendar_bp.route("/calendar/google/connect", methods=["GET"])
@jwt_required()
def google_calendar_connect():
    user_id = get_jwt_identity()

    try:
        auth_url = _build_authorization_url(user_id, _get_frontend_origin())
        return jsonify({"auth_url": auth_url}), 200
    except GoogleCalendarError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    except Exception as exc:
        logger.error(f"Erro ao iniciar conexao com Google Calendar: {exc}")
        return jsonify({"error": "Falha ao iniciar conexao com Google Calendar"}), 500


@google_calendar_bp.route("/calendar/google/callback", methods=["GET"])
def google_calendar_callback():
    fallback_origin = select_frontend_origin()
    state = request.args.get("state")
    target_origin = fallback_origin

    try:
        if not state:
            return redirect(_frontend_redirect(target_origin, "missing_state"))

        state_data = _get_state_serializer().loads(
            state,
            salt=GOOGLE_CALENDAR_STATE_SALT,
            max_age=600,
        )
        target_origin = state_data.get("origin") or fallback_origin
        user_id = state_data.get("user_id")

        if request.args.get("error"):
            return redirect(_frontend_redirect(target_origin, "denied"))

        code = request.args.get("code")
        if not code:
            return redirect(_frontend_redirect(target_origin, "missing_code"))

        client_id, client_secret = _get_google_client_config()
        token_payload = _request_google_token(
            {
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _calendar_redirect_uri(),
                "grant_type": "authorization_code",
            }
        )

        with get_db() as (cursor, conn):
            _ensure_google_calendar_tables(cursor)
            existing = _get_token_record(cursor, user_id)
            _save_token_payload(
                cursor,
                user_id,
                token_payload,
                existing_refresh_token=(existing or {}).get("refresh_token"),
                calendar_id=(existing or {}).get("calendar_id") or DEFAULT_CALENDAR_ID,
            )
            conn.commit()

        return redirect(_frontend_redirect(target_origin, "connected"))
    except (BadSignature, SignatureExpired):
        return redirect(_frontend_redirect(target_origin, "invalid_state"))
    except GoogleCalendarError as exc:
        logger.error(f"Erro no OAuth do Google Calendar: {exc}")
        return redirect(_frontend_redirect(target_origin, "error"))
    except Exception as exc:
        logger.error(f"Erro inesperado no callback do Google Calendar: {exc}")
        return redirect(_frontend_redirect(target_origin, "error"))


@google_calendar_bp.route("/calendar/google/sync", methods=["POST"])
@jwt_required()
def google_calendar_sync():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    requested_calendar_id = (data.get("calendarId") or "").strip()

    try:
        with get_db() as (cursor, conn):
            _ensure_google_calendar_tables(cursor)
            access_token, token_record = _get_valid_access_token(cursor, conn, user_id)
            calendar_id = requested_calendar_id or token_record.get("calendar_id") or DEFAULT_CALENDAR_ID
            items = _fetch_local_calendar_items(cursor, user_id)

            created = 0
            updated = 0
            failed = []

            for item in items:
                try:
                    action, event = _sync_one_event(cursor, user_id, access_token, calendar_id, item)
                    if action == "created":
                        created += 1
                    else:
                        updated += 1
                    _upsert_event_mapping(cursor, user_id, item, event["id"])
                except GoogleCalendarError as exc:
                    failed.append(
                        {
                            "id": item.get("id"),
                            "tipo": item.get("tipo"),
                            "error": str(exc),
                        }
                    )

            if requested_calendar_id:
                cursor.execute(
                    """
                    UPDATE google_calendar_tokens
                    SET calendar_id=%s, updated_at=CURRENT_TIMESTAMP
                    WHERE user_id=%s
                    """,
                    (calendar_id, user_id),
                )

            conn.commit()

        return (
            jsonify(
                {
                    "success": len(failed) == 0,
                    "calendarId": calendar_id,
                    "total": len(items),
                    "created": created,
                    "updated": updated,
                    "failed": failed,
                }
            ),
            200,
        )
    except GoogleCalendarError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    except Exception as exc:
        logger.error(f"Erro ao sincronizar Google Calendar: {exc}")
        return jsonify({"error": "Falha ao sincronizar Google Calendar"}), 500


@google_calendar_bp.route("/calendar/google/disconnect", methods=["DELETE"])
@jwt_required()
def google_calendar_disconnect():
    user_id = get_jwt_identity()

    try:
        with get_db() as (cursor, conn):
            _ensure_google_calendar_tables(cursor)
            cursor.execute("DELETE FROM google_calendar_events WHERE user_id=%s", (user_id,))
            cursor.execute("DELETE FROM google_calendar_tokens WHERE user_id=%s", (user_id,))
            conn.commit()
        return jsonify({"success": True, "message": "Google Calendar desconectado"}), 200
    except Exception as exc:
        logger.error(f"Erro ao desconectar Google Calendar: {exc}")
        return jsonify({"error": "Falha ao desconectar Google Calendar"}), 500
