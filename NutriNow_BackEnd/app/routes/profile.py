import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.database import get_db

logger = logging.getLogger(__name__)
profile_bp = Blueprint("profile", __name__)


def _truncate_text(text, limit=140):
    clean = " ".join((text or "").strip().split())
    if len(clean) <= limit:
        return clean
    return f"{clean[: limit - 3].rstrip()}..."


def _to_datetime(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    return datetime.now()


def _infer_insight_status(text, source_type=None):
    lowered = (text or "").lower()

    if source_type == "treino":
        return "positive"
    if source_type == "dieta":
        return "neutral"

    positive_terms = [
        "treino",
        "treinei",
        "academia",
        "proteina",
        "proteinas",
        "dormi bem",
        "hidrata",
        "foco",
    ]
    alert_terms = [
        "nao consegui",
        "n\u00e3o consegui",
        "desanimei",
        "cansado",
        "fome",
        "dor",
        "ansiedade",
    ]

    if any(term in lowered for term in alert_terms):
        return "alert"
    if any(term in lowered for term in positive_terms):
        return "positive"
    return "neutral"


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
        columns = {row["column_name"] for row in cursor.fetchall()}
        if "user_id" in columns:
            return "user_id"
        if "usuario_id" in columns:
            return "usuario_id"
    except Exception as exc:
        logger.warning(f"Nao foi possivel detectar coluna de usuario em dieta_treino: {exc}")
    return "user_id"


def _extract_conversation_insights(chat_rows, routine_rows, limit=4):
    insights = []
    seen = set()
    events = []

    for row in chat_rows:
        if row.get("message_type") != "human":
            continue

        content = _truncate_text(row.get("content"), 160)
        if not content:
            continue

        timestamp = _to_datetime(row.get("timestamp"))
        events.append(
            {
                "sort_time": timestamp,
                "date": timestamp.strftime("%Y-%m-%d"),
                "activity": content,
                "status": _infer_insight_status(content),
            }
        )

    for row in routine_rows:
        tipo = (row.get("tipo") or "").lower()
        title = _truncate_text(row.get("title"), 100)
        description = _truncate_text(row.get("description"), 120)
        timestamp = _to_datetime(row.get("updated_at") or row.get("created_at"))

        if tipo == "treino":
            activity = f"Treino registrado: {title or 'sem titulo'}"
        else:
            activity = f"Dieta registrada: {title or 'sem titulo'}"

        if description:
            activity = f"{activity}. {description}"

        events.append(
            {
                "sort_time": timestamp,
                "date": timestamp.strftime("%Y-%m-%d"),
                "activity": _truncate_text(activity, 170),
                "status": _infer_insight_status(activity, source_type=tipo),
            }
        )

    events.sort(key=lambda item: item["sort_time"], reverse=True)

    for event in events:
        key = (event["date"], event["activity"])
        if key in seen:
            continue
        seen.add(key)
        insights.append(
            {
                "date": event["date"],
                "activity": event["activity"],
                "status": event["status"],
            }
        )
        if len(insights) >= limit:
            break

    return insights


def _build_weight_history(current_weight, routine_rows):
    today = datetime.now().date()
    counts_by_day = {}

    for row in routine_rows:
        created_at = row.get("created_at")
        if not created_at:
            continue
        created_day = _to_datetime(created_at).date()
        if created_day < today - timedelta(days=6):
            continue
        counts_by_day[created_day] = counts_by_day.get(created_day, 0) + 1

    current_weight_value = float(current_weight) if current_weight else None
    history = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        entry_count = counts_by_day.get(day, 0)
        history.append(
            {
                "date": day.strftime("%d/%m"),
                "weight": current_weight_value if day == today else None,
                "activityLevel": min(100, entry_count * 25),
            }
        )

    return history


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


@profile_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard():
    user_id = get_jwt_identity()

    try:
        with get_db() as (cursor, conn):
            dieta_user_column = _resolve_dieta_user_column(cursor)

            cursor.execute(
                """
                SELECT
                    u.nome,
                    u.sobrenome,
                    IFNULL(p.meta, 'Nao definida') AS meta,
                    p.altura,
                    p.peso
                FROM usuarios u
                LEFT JOIN perfil p ON u.id = p.usuario_id
                WHERE u.id = %s
                """,
                (user_id,),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({"error": "Usuario nao encontrado"}), 404

            cursor.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM dieta_treino
                WHERE {dieta_user_column} = %s
                  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                """,
                (user_id,),
            )
            recent_plan_count = (cursor.fetchone() or {}).get("total", 0) or 0

            cursor.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM dieta_treino
                WHERE {dieta_user_column} = %s AND tipo = 'treino'
                """,
                (user_id,),
            )
            treino_count = (cursor.fetchone() or {}).get("total", 0) or 0

            cursor.execute(
                """
                SELECT message_type, content, timestamp
                FROM chat_history
                WHERE user_id = %s
                ORDER BY timestamp DESC
                LIMIT 40
                """,
                (user_id,),
            )
            chat_rows = cursor.fetchall() or []

            cursor.execute(
                f"""
                SELECT tipo, title, description, created_at, updated_at
                FROM dieta_treino
                WHERE {dieta_user_column} = %s
                ORDER BY COALESCE(updated_at, created_at) DESC
                LIMIT 40
                """,
                (user_id,),
            )
            routine_rows = cursor.fetchall() or []

        insights = _extract_conversation_insights(chat_rows, routine_rows)

        profile = {
            "name": " ".join(part for part in [user["nome"], user["sobrenome"]] if part).strip() or user["nome"],
            "height": float(user["altura"]) if user["altura"] else 0,
            "weight": float(user["peso"]) if user["peso"] else 0,
            "goal": user["meta"],
        }

        return (
            jsonify(
                {
                    "success": True,
                    "profile": profile,
                    "conversationInsights": insights,
                    "weightHistory": _build_weight_history(profile["weight"], routine_rows),
                    "stats": {
                        "recentPlans": recent_plan_count,
                        "totalTreinos": treino_count,
                    },
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(f"Erro ao buscar dashboard: {e}")
        return jsonify({"error": str(e)}), 500
