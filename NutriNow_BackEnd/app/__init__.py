import os
from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.routes.auth import auth_bp
from app.routes.chatbot import chatbot_bp
from app.routes.profile import profile_bp
from app.routes.fitness import fitness_bp

def _build_allowed_origins():
    defaults = [
        "https://drkcde15.github.io",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        # ADICIONE SE ESTIVER USANDO 8080
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    configured = os.getenv("CORS_ORIGINS", "")
    if configured:
        for origin in configured.split(","):
            origin = origin.strip()
            if origin and origin not in defaults:
                defaults.append(origin)

    single_origin = os.getenv("CORS_ORIGIN", "").strip()
    if single_origin and single_origin not in defaults:
        defaults.append(single_origin)

    return defaults


def create_app():
    load_dotenv()
    app = Flask(__name__)

    app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutrinow_super_secret_key_123")
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    app.config.update(
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY", "nutrinow_jwt_secret_key_999"),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(days=30),
    )

    JWTManager(app)

    allowed_origins = _build_allowed_origins()

    # DEBUG (remove depois)
    print("CORS ALLOWED ORIGINS:", allowed_origins)

    CORS(
        app,
        origins=allowed_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Session-ID"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(fitness_bp)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    return app