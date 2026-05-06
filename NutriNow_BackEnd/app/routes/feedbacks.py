import logging
import os
from html import escape
from flask import Blueprint, request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from app.database import get_db
from app.services.mail_service import envoyer_email

logger = logging.getLogger(__name__)
feedback_bp = Blueprint("feedback", __name__)

CREATE_FEEDBACKS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS feedbacks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(255),
    rating TINYINT UNSIGNED NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feedbacks_user (user_id),
    INDEX idx_feedbacks_created (created_at),
    CONSTRAINT fk_feedbacks_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT chk_feedbacks_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


def _notify_feedback_email(feedback_id, author_name, author_email, rating, message):
    recipient = os.getenv("EMAIL_SENDER").strip()
    if not recipient:
        logger.error("Destino de notificacao de feedback nao configurado")
        return False

    safe_name = escape(author_name or "Anonimo")
    safe_email = escape(author_email or "Nao informado")
    safe_message = escape(message).replace("\n", "<br>")

    subject = f"Novo feedback recebido - NutriNow (#{feedback_id})"
    html_body = f"""
    <html>
      <body>
        <h2>Novo feedback recebido</h2>
        <p><strong>ID:</strong> {feedback_id}</p>
        <p><strong>Nome:</strong> {safe_name}</p>
        <p><strong>Email:</strong> {safe_email}</p>
        <p><strong>Nota:</strong> {rating}/5</p>
        <p><strong>Comentario:</strong><br>{safe_message}</p>
      </body>
    </html>
    """
    return envoyer_email(recipient, subject, html_body)


@feedback_bp.route("/feedbacks", methods=["POST", "OPTIONS"])
def create_feedback():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    data = request.get_json(silent=True) or {}
    message = " ".join(str(data.get("message", "")).strip().split())
    name = " ".join(str(data.get("name", "")).strip().split())

    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({"error": "A nota deve ser um numero de 1 a 5"}), 400

    if rating < 1 or rating > 5:
        return jsonify({"error": "A nota deve estar entre 1 e 5"}), 400
    if len(message) < 5:
        return jsonify({"error": "Escreva uma mensagem com pelo menos 5 caracteres"}), 400
    if len(message) > 2000:
        return jsonify({"error": "A mensagem deve ter no maximo 2000 caracteres"}), 400
    if len(name) > 120:
        return jsonify({"error": "O nome deve ter no maximo 120 caracteres"}), 400

    user_id = None
    user_name = None
    user_email = None

    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity is not None:
            user_id = int(identity)
    except Exception as exc:
        logger.warning(f"Token invalido no envio de feedback: {exc}")

    try:
        with get_db() as (cursor, conn):
            cursor.execute(CREATE_FEEDBACKS_TABLE_SQL)
            if user_id is not None:
                cursor.execute("SELECT nome, email FROM usuarios WHERE id=%s", (user_id,))
                user = cursor.fetchone() or {}
                user_name = user.get("nome")
                user_email = user.get("email")

            author_name = name or user_name or "Anonimo"

            cursor.execute(
                """
                INSERT INTO feedbacks (user_id, nome, email, rating, message)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, author_name, user_email, rating, message),
            )
            feedback_id = cursor.lastrowid
            if not _notify_feedback_email(feedback_id, author_name, user_email, rating, message):
                conn.rollback()
                return jsonify({"error": "Falha ao enviar email de notificacao do feedback"}), 500

            conn.commit()

            return (
                jsonify(
                    {
                        "success": True,
                        "message": "Feedback enviado com sucesso!",
                        "feedbackId": feedback_id,
                    }
                ),
                201,
            )
    except Exception as exc:
        logger.error(f"Erro ao salvar feedback: {exc}")
        return jsonify({"error": "Falha ao salvar feedback"}), 500
