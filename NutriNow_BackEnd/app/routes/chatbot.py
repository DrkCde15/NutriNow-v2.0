import os
import uuid
import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.database import get_db
from app.services.agent_service import get_agent

logger = logging.getLogger(__name__)
chatbot_bp = Blueprint('chatbot', __name__)

UPLOAD_FOLDER = r"C:\Users\Júlio César\Pictures\Uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@chatbot_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    user_id = get_jwt_identity()
    with get_db() as (cursor, conn):
        cursor.execute("SELECT email FROM usuarios WHERE id=%s", (user_id,))
        user_data = cursor.fetchone()
    
    email = user_data["email"] if user_data else "guest"
    data = request.get_json()
    session_id = request.headers.get("X-Session-ID") or data.get("session_id") or str(uuid.uuid4())
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
    session_id = request.args.get("session_id") or request.headers.get("X-Session-ID")
    
    with get_db() as (cursor, conn):
        cursor.execute("SELECT email FROM usuarios WHERE id=%s", (user_id,))
        user_data = cursor.fetchone()
    email = user_data["email"] if user_data else "guest"
    
    agent = get_agent(session_id=session_id, user_id=user_id, email=email)
    history = agent.get_conversation_history(by_user=True)
    return jsonify({"success": True, "history": history})

@chatbot_bp.route("/analyze_image", methods=["POST", "OPTIONS"])
@jwt_required()
def analyze_image():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    try:
        user_id = get_jwt_identity()
        with get_db() as (cursor, conn):
            cursor.execute("SELECT email FROM usuarios WHERE id=%s", (user_id,))
            user_data = cursor.fetchone()
        email = user_data["email"] if user_data else "guest"

        session_id = request.headers.get('X-Session-ID') or request.form.get('session_id') or str(uuid.uuid4())
        
        if 'file' not in request.files:
            return jsonify({"error": "Nenhum arquivo enviado"}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "Nenhum arquivo selecionado"}), 400

        message_type = request.form.get('message_type', 'human')
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        with get_db() as (cursor, conn):
            cursor.execute(
                "INSERT INTO uploads (user_id, file_path, uploaded_at, message_type) VALUES (%s, %s, NOW(), %s)",
                (user_id, file_path, message_type)
            )
            conn.commit()

        agent = get_agent(session_id=session_id, user_id=user_id, email=email)
        analysis_result = agent.run_image(file_path)

        return jsonify({
            "success": True,
            "session_id": session_id,
            "file_path": file_path,
            "message_type": message_type,
            "response": analysis_result
        }), 200
    except Exception as e:
        logger.exception("Erro no endpoint /analyze_image")
        return jsonify({"success": False, "error": str(e)}), 500
