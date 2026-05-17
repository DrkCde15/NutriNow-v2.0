import os
import logging
from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import RequestEntityTooLarge
from app.routes.auth import auth_bp
from app.routes.chatbot import chatbot_bp
from app.routes.profile import profile_bp
from app.routes.fitness import fitness_bp
from app.routes.feedbacks import feedback_bp
from app.routes.calendar import google_calendar_bp
from app.security import build_allowed_origins, env_flag, is_development

logger = logging.getLogger(__name__)


def _secret_or_dev_fallback(name, fallback=None):
    value = os.getenv(name) or fallback
    if value:
        if not is_development() and len(value) < 32:
            raise RuntimeError(f"{name} deve ter pelo menos 32 caracteres em producao")
        return value

    if not is_development():
        raise RuntimeError(f"{name} precisa estar configurado em producao")

    logger.warning("%s nao configurado; usando segredo temporario somente para desenvolvimento", name)
    return f"dev-only-{name.lower()}-change-me-32-chars"


def create_app():
    load_dotenv()
    app = Flask(__name__)

    app.secret_key = _secret_or_dev_fallback("FLASK_SECRET_KEY")

    if is_development():
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
    else:
        os.environ.pop("OAUTHLIB_INSECURE_TRANSPORT", None)

    jwt_secret = _secret_or_dev_fallback("JWT_SECRET_KEY", app.secret_key)
    jwt_minutes = int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "60"))
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "5"))
    upload_folder = os.getenv("UPLOAD_FOLDER", os.path.join(os.getcwd(), "uploads"))
    chat_message_max_chars = int(os.getenv("CHAT_MESSAGE_MAX_CHARS", "8000"))

    app.config.update(
        JWT_SECRET_KEY=jwt_secret,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=jwt_minutes),
        MAX_CONTENT_LENGTH=max_upload_mb * 1024 * 1024,
        UPLOAD_FOLDER=upload_folder,
        CHAT_MESSAGE_MAX_CHARS=chat_message_max_chars,
    )

    JWTManager(app)

    allowed_origins = build_allowed_origins()

    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=env_flag("CORS_SUPPORTS_CREDENTIALS", False),
        allow_headers=["Content-Type", "Authorization", "X-Session-ID"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(fitness_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(google_calendar_bp)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    @app.errorhandler(RequestEntityTooLarge)
    def request_entity_too_large(_error):
        return jsonify({"error": "Arquivo excede o limite permitido"}), 413

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if not is_development():
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    return app
