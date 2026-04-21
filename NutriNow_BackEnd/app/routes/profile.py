import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.database import get_db

logger = logging.getLogger(__name__)
profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/perfil", methods=["GET"])
@jwt_required()
def get_perfil():
    user_id = get_jwt_identity()
    try:
        with get_db() as (cursor, conn):
            cursor.execute(
                """
                SELECT
                    u.nome,
                    u.sobrenome,
                    u.genero,
                    u.email,
                    u.data_nascimento,
                    IFNULL(p.meta, 'Nao definida') AS meta,
                    p.altura,
                    p.peso,
                    p.ja_treinou
                FROM usuarios u
                LEFT JOIN perfil p ON u.id = p.usuario_id
                WHERE u.id = %s
                """,
                (user_id,),
            )
            user = cursor.fetchone()
            if not user:
                return jsonify({"error": "Usuario nao encontrado"}), 404

            return (
                jsonify(
                    {
                        "success": True,
                        "nome": user["nome"],
                        "sobrenome": user["sobrenome"],
                        "genero": user["genero"],
                        "email": user["email"],
                        "dataNascimento": user["data_nascimento"].strftime("%Y-%m-%d")
                        if user["data_nascimento"]
                        else "",
                        "meta": user["meta"],
                        "altura": float(user["altura"]) if user["altura"] else None,
                        "peso": float(user["peso"]) if user["peso"] else None,
                        "ja_treinou": user["ja_treinou"] or "Nunca treinou",
                    }
                ),
                200,
            )
    except Exception as e:
        logger.error(f"Erro ao buscar perfil: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/perfil", methods=["POST"])
@jwt_required()
def update_perfil():
    user_id = get_jwt_identity()
    data = request.get_json()
    nome = data.get("nome")
    sobrenome = data.get("sobrenome")
    genero = data.get("genero")
    email = data.get("email")
    data_nascimento = data.get("dataNascimento")
    meta = data.get("meta")
    altura = data.get("altura")
    peso = data.get("peso")
    ja_treinou = data.get("ja_treinou")

    if data_nascimento:
        parsed_date = None
        for date_format in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                parsed_date = datetime.strptime(data_nascimento, date_format)
                break
            except ValueError:
                continue
        if parsed_date:
            data_nascimento = parsed_date.strftime("%Y-%m-%d")

    try:
        with get_db() as (cursor, conn):
            if any([nome, sobrenome, genero, email, data_nascimento]):
                query_parts = []
                params = []
                if nome:
                    query_parts.append("nome=%s")
                    params.append(nome)
                if sobrenome:
                    query_parts.append("sobrenome=%s")
                    params.append(sobrenome)
                if genero:
                    query_parts.append("genero=%s")
                    params.append(genero)
                if email:
                    query_parts.append("email=%s")
                    params.append(email)
                if data_nascimento:
                    query_parts.append("data_nascimento=%s")
                    params.append(data_nascimento)
                params.append(user_id)
                cursor.execute(f"UPDATE usuarios SET {', '.join(query_parts)} WHERE id=%s", tuple(params))

            cursor.execute("SELECT usuario_id FROM perfil WHERE usuario_id=%s", (user_id,))
            if cursor.fetchone():
                update_fields = []
                update_params = []
                if meta is not None:
                    update_fields.append("meta=%s")
                    update_params.append(meta)
                if altura is not None:
                    update_fields.append("altura=%s")
                    update_params.append(altura)
                if peso is not None:
                    update_fields.append("peso=%s")
                    update_params.append(peso)
                if ja_treinou is not None:
                    update_fields.append("ja_treinou=%s")
                    update_params.append(ja_treinou)

                if update_fields:
                    update_params.append(user_id)
                    cursor.execute(
                        f"UPDATE perfil SET {', '.join(update_fields)} WHERE usuario_id=%s",
                        tuple(update_params),
                    )
            else:
                cursor.execute(
                    "INSERT INTO perfil (usuario_id, meta, altura, peso, ja_treinou) VALUES (%s, %s, %s, %s, %s)",
                    (user_id, meta, altura, peso, ja_treinou),
                )
            conn.commit()
            return jsonify({"success": True, "message": "Perfil atualizado com sucesso!"}), 200
    except Exception as e:
        logger.error(f"Erro ao atualizar perfil: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/perfil", methods=["DELETE"])
@jwt_required()
def delete_perfil():
    user_id = get_jwt_identity()
    try:
        with get_db() as (cursor, conn):
            cursor.execute("DELETE FROM perfil WHERE usuario_id=%s", (user_id,))
            cursor.execute("DELETE FROM usuarios WHERE id=%s", (user_id,))
            conn.commit()
            return jsonify({"success": True, "message": "Conta e perfil excluidos com sucesso!"}), 200
    except Exception as e:
        logger.error(f"Erro ao excluir perfil: {e}")
        return jsonify({"error": str(e)}), 500
