import os
import secrets
import json
import logging
import requests
from flask import Blueprint, request, jsonify, redirect, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from oauthlib.oauth2 import WebApplicationClient
from datetime import datetime, timedelta
from dataclasses import dataclass
from app.database import get_db, get_db_connection
from app.services.mail_service import envoyer_email
from app.services.agent_service import clear_user_agents

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)

CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("SECRET_KEY_CLIENT")
client = WebApplicationClient(client_id=CLIENT_ID)

@dataclass
class GoogleHosts:
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    certs: str

def get_google_oauth_hosts():
    response = requests.get("https://accounts.google.com/.well-known/openid-configuration")
    if response.status_code != 200:
        raise Exception("Não foi possível recuperar os endpoints do Google OAuth")
    data = response.json()
    return GoogleHosts(
        authorization_endpoint=data.get("authorization_endpoint"), 
        token_endpoint=data.get("token_endpoint"), 
        userinfo_endpoint=data.get("userinfo_endpoint"), 
        certs=data.get("jwks_uri")
    )

@auth_bp.route("/cadastro", methods=["POST"])
def cadastro():
    data = request.get_json()
    nome = data.get("nome")
    sobrenome = data.get("sobrenome")
    data_nascimento = data.get("data_nascimento")
    genero = data.get("genero")
    email = data.get("email")
    senha = data.get("senha")
    
    meta = data.get("meta", "Não definida")
    altura = data.get("altura")
    peso = data.get("peso")
    ja_treinou = data.get("ja_treinou", "Nunca treinou")

    if not all([nome, sobrenome, email, senha]):
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    try:
        with get_db() as (cursor, conn):
            cursor.execute("SELECT id FROM usuarios WHERE email=%s", (email,))
            if cursor.fetchone():
                return jsonify({"error": "Email já cadastrado"}), 409

            senha_hash = generate_password_hash(senha)
            cursor.execute("""
                INSERT INTO usuarios (nome, sobrenome, data_nascimento, genero, email, senha)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (nome, sobrenome, data_nascimento, genero, email, senha_hash))
            
            user_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO perfil (usuario_id, meta, altura, peso, ja_treinou)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, meta, altura, peso, ja_treinou))

            conn.commit()
            return jsonify({"message": "Conta criada com sucesso!"}), 201
    except Exception as e:
        logger.error(f"Erro ao criar conta: {e}")
        return jsonify({"error": "Erro interno ao criar conta"}), 500

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    senha = data.get("senha")
    if not email or not senha:
        return jsonify({"error": "Email e senha são obrigatórios"}), 400

    try:
        with get_db() as (cursor, conn):
            cursor.execute("SELECT id, nome, email, senha FROM usuarios WHERE email=%s", (email,))
            user = cursor.fetchone()
            if not user or not check_password_hash(user["senha"], senha):
                return jsonify({"error": "Email ou senha inválidos"}), 401

            access_token = create_access_token(identity=str(user["id"]))
            return jsonify({
                "message": "Login realizado com sucesso!",
                "access_token": access_token,
                "user": {"id": user["id"], "nome": user["nome"], "email": user["email"]}
            }), 200
    except Exception as e:
        logger.error(f"Erro no login: {e}")
        return jsonify({"error": "Erro interno do servidor"}), 500

@auth_bp.route("/auth/login", methods=["GET"])
def google_login():
    hosts = get_google_oauth_hosts()
    authorization_url = client.prepare_request_uri(
        uri=hosts.authorization_endpoint,
        redirect_uri="http://localhost:8000/auth/callback",
        scope=["openid", "email", "profile"]
    )
    return jsonify({"auth_url": authorization_url}), 200

@auth_bp.route("/auth/callback")
def google_callback():
    code = request.args.get("code")
    if not code:
        return redirect(f"{os.getenv('FRONTEND_URL')}/login?error=missing_code")

    try:
        hosts = get_google_oauth_hosts()
        token_url, headers, body = client.prepare_token_request(
            token_url=hosts.token_endpoint,
            authorization_response=request.url,
            redirect_url="http://localhost:8000/auth/callback",
            code=code
        )
        
        token_response = requests.post(
            token_url,
            headers=headers,
            data=body,
            auth=(CLIENT_ID, CLIENT_SECRET),
        )

        client.parse_request_body_response(json.dumps(token_response.json()))
        uri, headers, body = client.add_token(hosts.userinfo_endpoint)
        user_info_response = requests.get(uri, headers=headers, data=body)

        if user_info_response.json().get("email_verified"):
            google_user = user_info_response.json()
            user_email = google_user["email"]
            user_name = google_user["name"]
            
            with get_db() as (cursor, conn):
                cursor.execute("SELECT id, nome, email FROM usuarios WHERE email=%s", (user_email,))
                user = cursor.fetchone()
                
                if not user:
                    senha_hash = generate_password_hash("oauth_" + secrets.token_hex(8))
                    partes_nome = user_name.split(' ', 1)
                    nome = partes_nome[0]
                    sobrenome = partes_nome[1] if len(partes_nome) > 1 else ""
                    
                    cursor.execute("""
                        INSERT INTO usuarios (nome, sobrenome, data_nascimento, genero, email, senha)
                        VALUES (%s, %s, '2000-01-01', 'Masculino', %s, %s)
                    """, (nome, sobrenome, user_email, senha_hash))
                    user_id = cursor.lastrowid
                    
                    cursor.execute("""
                        INSERT INTO perfil (usuario_id, meta, altura, peso, ja_treinou)
                        VALUES (%s, 'Não definida', NULL, NULL, 'Nunca treinou')
                    """, (user_id,))
                    conn.commit()
                    user_nome = nome
                else:
                    user_id = user["id"]
                    user_nome = user["nome"]

                # Determinar URL de redirecionamento dinâmica
                frontend_prod = "https://drkcde15.github.io/NutriNow"
                frontend_local = "http://localhost:5173/NutriNow"
                
                # Se a requisição veio de um ambiente local (checando referer ou host)
                referer = request.referrer or ""
                target_url = frontend_local if "localhost" in referer or "127.0.0.1" in referer else frontend_prod
                
                access_token = create_access_token(identity=str(user_id))
                return redirect(f"{target_url}/?access_token={access_token}&user_id={user_id}&user_name={user_nome}&user_email={user_email}")
        
        return redirect(f"https://drkcde15.github.io/NutriNow/login?error=email_not_verified")
    except Exception as e:
        logger.error(f"Erro no callback do google: {e}")
        return redirect(f"https://drkcde15.github.io/NutriNow/login?error=server_error")

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    user_id = get_jwt_identity()
    clear_user_agents(user_id)
    return jsonify({"message": "Logout realizado"}), 200

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    with get_db() as (cursor, conn):
        cursor.execute("SELECT id, nome, email FROM usuarios WHERE id=%s", (user_id,))
        user = cursor.fetchone()
    
    if not user:
        return jsonify({"error": "Usuário não encontrado"}), 404
        
    return jsonify({
        "id": user["id"],
        "nome": user["nome"],
        "email": user["email"]
    }), 200

@auth_bp.route('/esqueci-senha', methods=['POST'])
def esqueci_senha():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'O email é obrigatório.'}), 400

    try:
        with get_db() as (cursor, conn):
            cursor.execute("SELECT id, nome FROM usuarios WHERE email=%s", (email,))
            usuario = cursor.fetchone()
            if not usuario:
                return jsonify({'message': 'Email não cadastrado.'}), 404

            token = secrets.token_urlsafe(32)
            expiracao = datetime.now() + timedelta(hours=1)
            cursor.execute("INSERT INTO redefinicao_senha (usuario_id, token, data_expiracao) VALUES (%s, %s, %s)", 
                         (usuario['id'], token, expiracao))
            conn.commit()

            link_reset = f"{os.getenv('FRONTEND_URL')}/redefinir-senha?token={token}"
            mensagem_html = f"<html><body><h2>Redefinição de Senha</h2><p>Olá, {usuario['nome']}!</p><a href='{link_reset}'>Redefinir senha</a></body></html>"
            
            if envoyer_email(email, "Recuperação de Senha - NutriNow", mensagem_html):
                return jsonify({'message': 'As instruções foram enviadas para o e-mail.'}), 200
            return jsonify({'error': 'Falha ao enviar o e-mail.'}), 500
    except Exception as e:
        logger.error(f"Erro: {e}")
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/redefinir-senha', methods=['POST'])
def redefinir_senha():
    data = request.get_json()
    token = data.get('token')
    nova_senha = data.get('nova_senha')
    if not token or not nova_senha:
        return jsonify({'error': 'Token e nova senha são obrigatórios.'}), 400

    try:
        with get_db() as (cursor, conn):
            cursor.execute("SELECT usuario_id FROM redefinicao_senha WHERE token=%s AND data_expiracao > NOW()", (token,))
            registro = cursor.fetchone()
            if not registro:
                return jsonify({'error': 'Token inválido ou expirado.'}), 400

            senha_hash = generate_password_hash(nova_senha)
            cursor.execute("UPDATE usuarios SET senha=%s WHERE id=%s", (senha_hash, registro['usuario_id']))
            cursor.execute("DELETE FROM redefinicao_senha WHERE token=%s", (token,))
            conn.commit()
            return jsonify({'message': 'Senha redefinida com sucesso!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
