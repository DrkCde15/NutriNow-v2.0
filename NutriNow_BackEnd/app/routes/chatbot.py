import logging
import os
import re
import unicodedata
import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.database import get_db
from app.services.agent_service import clear_session_agent, get_agent

logger = logging.getLogger(__name__)
chatbot_bp = Blueprint("chatbot", __name__)

UPLOAD_FOLDER = r"C:\Users\Júlio César\Pictures\Uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
GENERIC_CHAT_TOKENS = {
    "oi",
    "ola",
    "ok",
    "okay",
    "sim",
    "nao",
    "valeu",
    "obrigado",
    "obrigada",
    "bom",
    "boa",
    "dia",
    "tarde",
    "noite",
    "tudo",
    "bem",
}


def _normalize_session_id(value, create_if_missing=False):
    session_id = (value or "").strip()
    if not session_id and create_if_missing:
        return str(uuid.uuid4())
    if session_id and SESSION_ID_RE.match(session_id):
        return session_id
    return None


def _normalize_chat_text(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^\w\s-]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def _is_generic_chat_message(message):
    tokens = [token for token in _normalize_chat_text(message).split(" ") if token]
    return bool(tokens) and len(tokens) <= 5 and all(token in GENERIC_CHAT_TOKENS for token in tokens)


def _truncate_text(value, limit=80):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rstrip()}..."


def _serialize_timestamp(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def _get_user_email(user_id):
    with get_db() as (cursor, conn):
        cursor.execute("SELECT email FROM usuarios WHERE id=%s", (user_id,))
        user_data = cursor.fetchone()
    return user_data["email"] if user_data else "guest"


def _build_session_summaries(user_id, limit=50):
    with get_db() as (cursor, conn):
        cursor.execute(
            """
            SELECT
                session_id,
                MIN(timestamp) AS created_at,
                MAX(timestamp) AS updated_at,
                COUNT(*) AS message_count
            FROM chat_history
            WHERE user_id = %s AND session_id IS NOT NULL AND session_id != ''
            GROUP BY session_id
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        grouped = cursor.fetchall() or []

        if not grouped:
            return []

        session_ids = [row["session_id"] for row in grouped]
        placeholders = ", ".join(["%s"] * len(session_ids))
        cursor.execute(
            f"""
            SELECT session_id, message_type, content, timestamp
            FROM chat_history
            WHERE user_id = %s AND session_id IN ({placeholders})
            ORDER BY timestamp ASC, id ASC
            """,
            tuple([user_id, *session_ids]),
        )
        rows = cursor.fetchall() or []

    messages_by_session = {}
    for row in rows:
        messages_by_session.setdefault(row["session_id"], []).append(row)

    sessions = []
    for row in grouped:
        session_id = row["session_id"]
        messages = messages_by_session.get(session_id, [])
        human_messages = [m for m in messages if m["message_type"] == "human"]
        title_source = next((m["content"] for m in human_messages if not _is_generic_chat_message(m["content"])), None)
        if not title_source and human_messages:
            title_source = human_messages[0]["content"]
        if not title_source and messages:
            title_source = messages[0]["content"]

        last_message = messages[-1]["content"] if messages else ""

        sessions.append(
            {
                "session_id": session_id,
                "title": _truncate_text(title_source or "Nova conversa", 72),
                "preview": _truncate_text(last_message, 120),
                "created_at": _serialize_timestamp(row["created_at"]),
                "updated_at": _serialize_timestamp(row["updated_at"]),
                "message_count": row["message_count"],
            }
        )

    return sessions


@chatbot_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    user_id = get_jwt_identity()
    email = _get_user_email(user_id)
    data = request.get_json(silent=True) or {}
    session_id = _normalize_session_id(
        request.headers.get("X-Session-ID") or data.get("session_id"),
        create_if_missing=True,
    )
    if not session_id:
        return jsonify({"error": "Sessao invalida"}), 400

    message = data.get("message")
    if not message:
        return jsonify({"error": "Mensagem vazia"}), 400

    agent = get_agent(session_id=session_id, user_id=user_id, email=email)
    response_text = agent.run_text(message)
    return jsonify({"success": True, "session_id": session_id, "response": response_text}), 200


@chatbot_bp.route("/chat_history", methods=["GET"])
@jwt_required()
def chat_history():
    user_id = get_jwt_identity()
    session_id = _normalize_session_id(request.args.get("session_id") or request.headers.get("X-Session-ID"))
    if not session_id:
        return jsonify({"error": "Sessao invalida"}), 400

    with get_db() as (cursor, conn):
        cursor.execute(
            """
            SELECT message_type, content, timestamp
            FROM chat_history
            WHERE user_id = %s AND session_id = %s
            ORDER BY timestamp ASC, CASE WHEN message_type = 'human' THEN 0 ELSE 1 END, id ASC
            LIMIT 200
            """,
            (user_id, session_id),
        )
        rows = cursor.fetchall() or []

    history = [
        {
            "role": "user" if row["message_type"] == "human" else "assistant",
            "content": row["content"],
            "timestamp": _serialize_timestamp(row["timestamp"]),
        }
        for row in rows
    ]
    return jsonify({"success": True, "history": history})


@chatbot_bp.route("/chat_sessions", methods=["GET"])
@jwt_required()
def chat_sessions():
    user_id = get_jwt_identity()
    try:
        sessions = _build_session_summaries(user_id)
        return jsonify({"success": True, "sessions": sessions}), 200
    except Exception as e:
        logger.exception("Erro ao listar sessoes de chat")
        return jsonify({"success": False, "error": str(e)}), 500


@chatbot_bp.route("/chat_sessions/<session_id>", methods=["DELETE"])
@jwt_required()
def delete_chat_session(session_id):
    user_id = get_jwt_identity()
    session_id = _normalize_session_id(session_id)
    if not session_id:
        return jsonify({"error": "Sessao invalida"}), 400

    try:
        with get_db() as (cursor, conn):
            cursor.execute(
                "DELETE FROM chat_history WHERE user_id = %s AND session_id = %s",
                (user_id, session_id),
            )
            deleted = cursor.rowcount
            conn.commit()

        clear_session_agent(user_id, session_id)
        if deleted <= 0:
            return jsonify({"error": "Conversa nao encontrada"}), 404
        return jsonify({"success": True, "deleted": deleted}), 200
    except Exception as e:
        logger.exception("Erro ao excluir sessao de chat")
        return jsonify({"success": False, "error": str(e)}), 500


@chatbot_bp.route("/analyze_image", methods=["POST", "OPTIONS"])
@jwt_required()
def analyze_image():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        user_id = get_jwt_identity()
        email = _get_user_email(user_id)

        session_id = _normalize_session_id(
            request.headers.get("X-Session-ID") or request.form.get("session_id"),
            create_if_missing=True,
        )
        if not session_id:
            return jsonify({"error": "Sessao invalida"}), 400

        if "file" not in request.files:
            return jsonify({"error": "Nenhum arquivo enviado"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Nenhum arquivo selecionado"}), 400

        message_type = request.form.get("message_type", "human")
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        with get_db() as (cursor, conn):
            cursor.execute(
                "INSERT INTO uploads (user_id, file_path, uploaded_at, message_type) VALUES (%s, %s, NOW(), %s)",
                (user_id, file_path, message_type),
            )
            conn.commit()

        agent = get_agent(session_id=session_id, user_id=user_id, email=email)
        analysis_result = agent.run_image(file_path)
        agent._save_message("human", f"Imagem enviada: {file.filename}")
        agent._save_message("ai", analysis_result)

        return jsonify({
            "success": True,
            "session_id": session_id,
            "file_path": file_path,
            "message_type": message_type,
            "response": analysis_result,
        }), 200
    except Exception as e:
        logger.exception("Erro no endpoint /analyze_image")
        return jsonify({"success": False, "error": str(e)}), 500
