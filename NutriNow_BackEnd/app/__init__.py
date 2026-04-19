import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
from dotenv import load_dotenv

def create_app():
    load_dotenv()
    app = Flask(__name__)
    
    # Configurações
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutrinow_super_secret_key_123")
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    
    app.config.update(
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY", "nutrinow_jwt_secret_key_999"),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(days=30),
    )
    
    JWTManager(app)
    
    # Permitir múltiplos origens (Local e Produção)
    allowed_origins = [
        "https://drkcde15.github.io",
        "http://localhost:5173",
        "http://localhost:4200",
        "http://127.0.0.1:5173"
    ]
    
    CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)

    # Registro de Blueprints
    from app.routes.auth import auth_bp
    from app.routes.chatbot import chatbot_bp
    from app.routes.profile import profile_bp
    from app.routes.fitness import fitness_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(fitness_bp)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Session-ID')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE')
        return response

    return app
