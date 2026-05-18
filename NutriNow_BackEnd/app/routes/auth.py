import json
import logging
import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import sha256
from html import escape
from threading import Lock
from urllib.parse import urlencode

import requests
from flask import Blueprint, current_app, jsonify, redirect, request, url_for
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    set_refresh_cookies,
    unset_jwt_cookies,
    verify_jwt_in_request,
)
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from oauthlib.oauth2 import WebApplicationClient
from werkzeug.security import check_password_hash, generate_password_hash

from app.database import get_db
from app.security import (
    check_rate_limit,
    get_request_origin,
    normalize_email,
    rate_limit_response,
    select_frontend_origin,
    validate_email,
    validate_password,
)
from app.services.agent_service import clear_user_agents
from app.services.account_cache import get_cached_account, set_cached_account
from app.services.mail_service import envoyer_email

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__)

GOOGLE_LOGIN_STATE_SALT = "nutrinow-google-login-state"
GOOGLE_LOGIN_CODE_SALT = "nutrinow-google-login-code"
GOOGLE_LOGIN_STATE_MAX_AGE = 600
GOOGLE_LOGIN_CODE_MAX_AGE = 300
PASSWORD_RESET_SUCCESS_MESSAGE = "Se o email estiver cadastrado, enviaremos instrucoes para redefinir a senha."

_google_hosts_cache = {"expires_at": 0, "value": None}
_google_hosts_lock = Lock()
_used_oauth_exchange_codes = {}
_oauth_code_lock = Lock()


@dataclass
class GoogleHosts:
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    certs: str


def get_google_client_config():
    client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("SECRET_KEY_CLIENT")

    if not client_id or not client_secret:
        raise RuntimeError("Credenciais OAuth do Google nao configuradas")

    return client_id, client_secret


def create_google_oauth_client():
    client_id, client_secret = get_google_client_config()
    return WebApplicationClient(client_id=client_id), client_id, client_secret


def get_google_oauth_hosts():
    now = time.time()
    with _google_hosts_lock:
        if _google_hosts_cache["value"] and _google_hosts_cache["expires_at"] > now:
            return _google_hosts_cache["value"]

    response = requests.get("https://accounts.google.com/.well-known/openid-configuration", timeout=10)
    if not response.ok:
        raise RuntimeError("Nao foi possivel recuperar os endpoints do Google OAuth")

    data = response.json()
    hosts = GoogleHosts(
        authorization_endpoint=data.get("authorization_endpoint"),
        token_endpoint=data.get("token_endpoint"),
        userinfo_endpoint=data.get("userinfo_endpoint"),
        certs=data.get("jwks_uri"),
    )

    with _google_hosts_lock:
        _google_hosts_cache["value"] = hosts
        _google_hosts_cache["expires_at"] = now + 3600

    return hosts


def _get_state_serializer():
    secret = (
        current_app.secret_key
        or current_app.config.get("JWT_SECRET_KEY")
        or os.getenv("JWT_SECRET_KEY")
        or os.getenv("FLASK_SECRET_KEY")
    )
    if not secret:
        raise RuntimeError("Chave de assinatura do app nao configurada")
    return URLSafeTimedSerializer(secret)


def _google_login_redirect_uri():
    configured = os.getenv("GOOGLE_LOGIN_REDIRECT_URI") or os.getenv("GOOGLE_REDIRECT_URI")
    if configured:
        return configured.strip()
    return url_for("auth.google_callback", _external=True)


def _frontend_redirect(origin, path="/login", **params):
    target_origin = select_frontend_origin(origin)
    query = urlencode(params)
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{target_origin}{normalized_path}{'?' + query if query else ''}"


def _issue_oauth_exchange_code(user_id):
    payload = {
        "user_id": str(user_id),
        "jti": secrets.token_urlsafe(24),
    }
    return _get_state_serializer().dumps(payload, salt=GOOGLE_LOGIN_CODE_SALT)


def _consume_oauth_exchange_code(code):
    payload = _get_state_serializer().loads(
        code,
        salt=GOOGLE_LOGIN_CODE_SALT,
        max_age=GOOGLE_LOGIN_CODE_MAX_AGE,
    )
    jti = payload.get("jti")
    user_id = payload.get("user_id")
    if not jti or not user_id:
        raise BadSignature("Codigo OAuth malformado")

    now = time.time()
    with _oauth_code_lock:
        expired = [key for key, expires_at in _used_oauth_exchange_codes.items() if expires_at <= now]
        for key in expired:
            _used_oauth_exchange_codes.pop(key, None)

        if jti in _used_oauth_exchange_codes:
            raise BadSignature("Codigo OAuth ja utilizado")

        _used_oauth_exchange_codes[jti] = now + GOOGLE_LOGIN_CODE_MAX_AGE

    return str(user_id)


def _hash_reset_token(token):
    return sha256(str(token or "").encode("utf-8")).hexdigest()


def _optional_float(value):
    if value is None:
        return None
    return float(value)


def _account_payload(user):
    return {
        "id": user["id"],
        "nome": user["nome"],
        "email": user["email"],
        "altura": _optional_float(user.get("altura")),
        "peso": _optional_float(user.get("peso")),
    }


def _refresh_cookie_max_age():
    return int(os.getenv("JWT_REFRESH_TOKEN_DAYS", "30")) * 24 * 60 * 60


def _set_refresh_cookie(response, user_id):
    refresh_token = create_refresh_token(identity=str(user_id))
    set_refresh_cookies(response, refresh_token, max_age=_refresh_cookie_max_age())
    return response


def _account_by_id(user_id):
    cached_user = get_cached_account(user_id)
    if cached_user:
        return cached_user

    with get_db() as (cursor, conn):
        cursor.execute(
            """
            SELECT u.id, u.nome, u.email, p.altura, p.peso
            FROM usuarios u
            LEFT JOIN perfil p ON u.id = p.usuario_id
            WHERE u.id=%s
            LIMIT 1
            """,
            (user_id,),
        )
        user = cursor.fetchone()

    if not user:
        return None

    payload = _account_payload(user)
    set_cached_account(user_id, payload)
    return payload


def _auth_response(user, message="Login realizado com sucesso!"):
    account = _account_payload(user)
    access_token = create_access_token(identity=str(account["id"]))
    set_cached_account(account["id"], account)
    response = jsonify(
        {
            "message": message,
            "access_token": access_token,
            "user": account,
        }
    )
    _set_refresh_cookie(response, account["id"])
    return response


@auth_bp.route("/cadastro", methods=["POST", "OPTIONS"])
def cadastro():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    data = request.get_json(silent=True) or {}
    nome = str(data.get("nome") or "").strip()
    sobrenome = str(data.get("sobrenome") or "").strip()
    data_nascimento = data.get("data_nascimento")
    genero = data.get("genero")
    email = validate_email(data.get("email"))
    senha = data.get("senha")
    meta = data.get("meta", "Nao definida")
    altura = data.get("altura")
    peso = data.get("peso")
    ja_treinou = data.get("ja_treinou", "Nunca treinou")

    if not all([nome, sobrenome, email, senha]):
        return jsonify({"error": "Campos obrigatorios ausentes"}), 400

    password_error = validate_password(senha)
    if password_error:
        return jsonify({"error": password_error}), 400

    allowed, retry_after = check_rate_limit("cadastro", 8, 3600, email)
    if not allowed:
        return rate_limit_response(retry_after)

    try:
        with get_db() as (cursor, conn):
            cursor.execute("SELECT id FROM usuarios WHERE email=%s", (email,))
            if cursor.fetchone():
                return jsonify({"error": "Email ja cadastrado"}), 409

            senha_hash = generate_password_hash(senha)
            cursor.execute(
                """
                INSERT INTO usuarios (nome, sobrenome, data_nascimento, genero, email, senha)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (nome, sobrenome, data_nascimento, genero, email, senha_hash),
            )

            user_id = cursor.lastrowid
            cursor.execute(
                """
                INSERT INTO perfil (usuario_id, meta, altura, peso, ja_treinou)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, meta, altura, peso, ja_treinou),
            )

            conn.commit()
            return jsonify({"message": "Conta criada com sucesso!"}), 201
    except Exception as exc:
        logger.error(f"Erro ao criar conta: {exc}")
        return jsonify({"error": "Erro interno ao criar conta"}), 500


@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200

    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    senha = data.get("senha")
    if not email or not senha:
        return jsonify({"error": "Email e senha sao obrigatorios"}), 400

    allowed, retry_after = check_rate_limit("login", 10, 300, email)
    if not allowed:
        return rate_limit_response(retry_after)

    try:
        with get_db() as (cursor, conn):
            cursor.execute(
                """
                SELECT u.id, u.nome, u.email, u.senha, p.altura, p.peso
                FROM usuarios u
                LEFT JOIN perfil p ON u.id = p.usuario_id
                WHERE u.email=%s
                LIMIT 1
                """,
                (email,),
            )
            user = cursor.fetchone()
            if not user or not check_password_hash(user["senha"], senha):
                return jsonify({"error": "Email ou senha invalidos"}), 401

            return _auth_response(user), 200
    except Exception as exc:
        logger.error(f"Erro no login: {exc}")
        return jsonify({"error": "Erro interno do servidor"}), 500


@auth_bp.route("/auth/login", methods=["GET"])
def google_login():
    try:
        origin = get_request_origin()
        target_origin = select_frontend_origin(origin, strict=bool(origin))
        client, _, _ = create_google_oauth_client()
        hosts = get_google_oauth_hosts()
        state = _get_state_serializer().dumps(
            {"origin": target_origin, "nonce": secrets.token_urlsafe(24)},
            salt=GOOGLE_LOGIN_STATE_SALT,
        )

        authorization_url = client.prepare_request_uri(
            uri=hosts.authorization_endpoint,
            redirect_uri=_google_login_redirect_uri(),
            scope=["openid", "email", "profile"],
            state=state,
        )
        return jsonify({"auth_url": authorization_url}), 200
    except ValueError:
        return jsonify({"error": "Origem de frontend nao permitida"}), 400
    except Exception as exc:
        logger.error(f"Erro ao iniciar OAuth do Google: {exc}")
        return jsonify({"error": "Falha ao iniciar login com Google"}), 500


@auth_bp.route("/auth/callback")
def google_callback():
    fallback_origin = select_frontend_origin()
    target_origin = fallback_origin

    try:
        state = request.args.get("state")
        if not state:
            return redirect(_frontend_redirect(target_origin, "/login", error="missing_state"))

        state_data = _get_state_serializer().loads(
            state,
            salt=GOOGLE_LOGIN_STATE_SALT,
            max_age=GOOGLE_LOGIN_STATE_MAX_AGE,
        )
        target_origin = select_frontend_origin(state_data.get("origin"), strict=True)

        if request.args.get("error"):
            return redirect(_frontend_redirect(target_origin, "/login", error="google_denied"))

        code = request.args.get("code")
        if not code:
            return redirect(_frontend_redirect(target_origin, "/login", error="missing_code"))

        client, client_id, client_secret = create_google_oauth_client()
        hosts = get_google_oauth_hosts()
        token_url, headers, body = client.prepare_token_request(
            token_url=hosts.token_endpoint,
            authorization_response=request.url,
            redirect_url=_google_login_redirect_uri(),
            code=code,
        )

        token_response = requests.post(
            token_url,
            headers=headers,
            data=body,
            auth=(client_id, client_secret),
            timeout=10,
        )
        if not token_response.ok:
            logger.warning("Google OAuth recusou token: %s", token_response.text[:300])
            return redirect(_frontend_redirect(target_origin, "/login", error="google_oauth_error"))

        client.parse_request_body_response(json.dumps(token_response.json()))
        uri, headers, body = client.add_token(hosts.userinfo_endpoint)
        user_info_response = requests.get(uri, headers=headers, data=body, timeout=10)
        if not user_info_response.ok:
            logger.warning("Falha ao buscar userinfo do Google: %s", user_info_response.text[:300])
            return redirect(_frontend_redirect(target_origin, "/login", error="google_oauth_error"))

        google_user = user_info_response.json()
        if not google_user.get("email_verified"):
            return redirect(_frontend_redirect(target_origin, "/login", error="email_not_verified"))

        user_email = validate_email(google_user.get("email"))
        if not user_email:
            return redirect(_frontend_redirect(target_origin, "/login", error="invalid_email"))

        user_name = str(google_user.get("name") or user_email.split("@", 1)[0]).strip()

        with get_db() as (cursor, conn):
            cursor.execute("SELECT id, nome, email FROM usuarios WHERE email=%s", (user_email,))
            user = cursor.fetchone()

            if not user:
                senha_hash = generate_password_hash("oauth_" + secrets.token_hex(16))
                partes_nome = user_name.split(" ", 1)
                nome = partes_nome[0] or user_email.split("@", 1)[0]
                sobrenome = partes_nome[1] if len(partes_nome) > 1 else ""

                cursor.execute(
                    """
                    INSERT INTO usuarios (nome, sobrenome, data_nascimento, genero, email, senha)
                    VALUES (%s, %s, '2000-01-01', 'Masculino', %s, %s)
                    """,
                    (nome, sobrenome, user_email, senha_hash),
                )
                user_id = cursor.lastrowid

                cursor.execute(
                    """
                    INSERT INTO perfil (usuario_id, meta, altura, peso, ja_treinou)
                    VALUES (%s, 'Nao definida', NULL, NULL, 'Nunca treinou')
                    """,
                    (user_id,),
                )
                conn.commit()
            else:
                user_id = user["id"]

        exchange_code = _issue_oauth_exchange_code(user_id)
        return redirect(f"{target_origin}/?{urlencode({'auth_code': exchange_code})}")
    except (BadSignature, SignatureExpired, ValueError):
        return redirect(_frontend_redirect(fallback_origin, "/login", error="invalid_state"))
    except Exception as exc:
        logger.error(f"Erro no callback do Google: {exc}")
        return redirect(_frontend_redirect(target_origin, "/login", error="server_error"))


@auth_bp.route("/auth/exchange-code", methods=["POST"])
def exchange_google_auth_code():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "Codigo de autenticacao ausente"}), 400

    allowed, retry_after = check_rate_limit("oauth_exchange", 30, 300)
    if not allowed:
        return rate_limit_response(retry_after)

    try:
        user_id = _consume_oauth_exchange_code(code)
    except (BadSignature, SignatureExpired):
        return jsonify({"error": "Codigo de autenticacao invalido ou expirado"}), 400

    try:
        with get_db() as (cursor, conn):
            cursor.execute(
                """
                SELECT u.id, u.nome, u.email, p.altura, p.peso
                FROM usuarios u
                LEFT JOIN perfil p ON u.id = p.usuario_id
                WHERE u.id=%s
                LIMIT 1
                """,
                (user_id,),
            )
            user = cursor.fetchone()

        if not user:
            return jsonify({"error": "Usuario nao encontrado"}), 404

        return _auth_response(user), 200
    except Exception as exc:
        logger.error(f"Erro ao trocar codigo OAuth: {exc}")
        return jsonify({"error": "Erro interno do servidor"}), 500


@auth_bp.route("/logout", methods=["POST"])
def logout():
    try:
        verify_jwt_in_request(optional=True, locations=["headers"])
        user_id = get_jwt_identity()
        if user_id:
            clear_user_agents(user_id)
    except Exception:
        pass

    response = jsonify({"message": "Logout realizado"})
    unset_jwt_cookies(response)
    return response, 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True, locations=["cookies"])
def refresh_session():
    user_id = get_jwt_identity()

    allowed, retry_after = check_rate_limit("refresh", 120, 300, user_id)
    if not allowed:
        return rate_limit_response(retry_after)

    account = _account_by_id(user_id)
    if not account:
        response = jsonify({"error": "Usuario nao encontrado"})
        unset_jwt_cookies(response)
        return response, 404

    access_token = create_access_token(identity=str(account["id"]))
    response = jsonify(
        {
            "message": "Sessao renovada com sucesso!",
            "access_token": access_token,
            "user": account,
        }
    )
    _set_refresh_cookie(response, account["id"])
    return response, 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    account = _account_by_id(user_id)
    if not account:
        return jsonify({"error": "Usuario nao encontrado"}), 404

    return jsonify(account), 200


@auth_bp.route("/esqueci-senha", methods=["POST"])
def esqueci_senha():
    data = request.get_json(silent=True) or {}
    email = validate_email(data.get("email"))
    if not email:
        return jsonify({"error": "Informe um email valido."}), 400

    allowed, retry_after = check_rate_limit("password_reset_request", 5, 3600, email)
    if not allowed:
        return rate_limit_response(retry_after)

    try:
        with get_db() as (cursor, conn):
            cursor.execute("SELECT id, nome FROM usuarios WHERE email=%s", (email,))
            usuario = cursor.fetchone()
            if not usuario:
                return jsonify({"message": PASSWORD_RESET_SUCCESS_MESSAGE}), 200

            token = secrets.token_urlsafe(32)
            expiracao = datetime.now() + timedelta(hours=1)
            cursor.execute("DELETE FROM redefinicao_senha WHERE usuario_id=%s", (usuario["id"],))
            cursor.execute(
                "INSERT INTO redefinicao_senha (usuario_id, token, data_expiracao) VALUES (%s, %s, %s)",
                (usuario["id"], _hash_reset_token(token), expiracao),
            )
            conn.commit()

        origin = select_frontend_origin(get_request_origin())
        link_reset = f"{origin}/reset-senha?{urlencode({'token': token})}"
        safe_name = escape(usuario.get("nome") or "usuario")
        safe_link = escape(link_reset, quote=True)
        mensagem_html = (
            "<html><body>"
            "<h2>Redefinicao de Senha</h2>"
            f"<p>Ola, {safe_name}!</p>"
            f"<a href='{safe_link}'>Redefinir senha</a>"
            "</body></html>"
        )

        if not envoyer_email(email, "Recuperacao de Senha - NutriNow", mensagem_html):
            logger.error("Falha ao enviar email de recuperacao para usuario_id=%s", usuario["id"])

        return jsonify({"message": PASSWORD_RESET_SUCCESS_MESSAGE}), 200
    except Exception as exc:
        logger.error(f"Erro ao solicitar redefinicao de senha: {exc}")
        return jsonify({"error": "Erro interno ao solicitar redefinicao de senha"}), 500


@auth_bp.route("/redefinir-senha", methods=["POST"])
def redefinir_senha():
    data = request.get_json(silent=True) or {}
    token = str(data.get("token") or "").strip()
    nova_senha = data.get("nova_senha")
    if not token or not nova_senha:
        return jsonify({"error": "Token e nova senha sao obrigatorios."}), 400

    password_error = validate_password(nova_senha)
    if password_error:
        return jsonify({"error": password_error}), 400

    allowed, retry_after = check_rate_limit("password_reset_confirm", 10, 3600)
    if not allowed:
        return rate_limit_response(retry_after)

    try:
        with get_db() as (cursor, conn):
            cursor.execute(
                "SELECT usuario_id FROM redefinicao_senha WHERE token=%s AND data_expiracao > NOW()",
                (_hash_reset_token(token),),
            )
            registro = cursor.fetchone()
            if not registro:
                return jsonify({"error": "Token invalido ou expirado."}), 400

            senha_hash = generate_password_hash(nova_senha)
            cursor.execute("UPDATE usuarios SET senha=%s WHERE id=%s", (senha_hash, registro["usuario_id"]))
            cursor.execute("DELETE FROM redefinicao_senha WHERE usuario_id=%s", (registro["usuario_id"],))
            conn.commit()
            return jsonify({"message": "Senha redefinida com sucesso!"}), 200
    except Exception as exc:
        logger.error(f"Erro ao redefinir senha: {exc}")
        return jsonify({"error": "Erro interno ao redefinir senha"}), 500
