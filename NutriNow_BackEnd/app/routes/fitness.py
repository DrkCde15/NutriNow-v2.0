import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.database import get_db, get_db_connection
from app.routes.calendar import delete_google_calendar_item, sync_google_calendar_item

logger = logging.getLogger(__name__)
fitness_bp = Blueprint('fitness', __name__)


def _parse_scheduled_at(data):
    date_value = str(data.get("date") or data.get("created_at") or data.get("startsAt") or "").strip()
    if not date_value:
        return None

    scheduled_at = datetime.strptime(date_value[:10], "%Y-%m-%d")
    time_value = str(data.get("time") or "").strip()

    if len(time_value) == 5 and time_value[2] == ":":
        hours, minutes = [int(part) for part in time_value.split(":")]
        scheduled_at = scheduled_at.replace(hour=hours, minute=minutes)

    return scheduled_at


@fitness_bp.route('/dieta-treino', methods=['GET'])
@jwt_required()
def get_items():
    user_id = get_jwt_identity()
    aba = request.args.get('tipo', 'treinos')
    tipo = 'treino' if 'treino' in str(aba).lower() else 'dieta'

    try:
        with get_db() as (cursor, conn):
            cursor.execute("""
                SELECT id, title, description, time, tipo, created_at, updated_at
                FROM dieta_treino
                WHERE user_id=%s AND tipo=%s
                ORDER BY created_at ASC
            """, (user_id, tipo))
            items = cursor.fetchall()
            return jsonify({"success": True, "items": items}), 200
    except Exception as e:
        logger.error(f"Erro ao buscar itens: {e}")
        return jsonify({"error": "Falha ao buscar itens"}), 500

@fitness_bp.route('/dieta-treino', methods=['POST'])
@jwt_required()
def add_item():
    user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    description = data.get('description')
    time = data.get('time')
    aba = str(data.get('tipo', '')).lower()
    scheduled_at = _parse_scheduled_at(data)

    if not all([title, description, aba]):
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    tipo = 'treino' if 'treino' in aba else 'dieta'
    try:
        with get_db() as (cursor, conn):
            if scheduled_at:
                cursor.execute("""
                    INSERT INTO dieta_treino (user_id, tipo, title, description, time, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (user_id, tipo, title, description, time, scheduled_at, scheduled_at))
            else:
                cursor.execute("""
                    INSERT INTO dieta_treino (user_id, tipo, title, description, time)
                    VALUES (%s, %s, %s, %s, %s)
                """, (user_id, tipo, title, description, time))
            item_id = cursor.lastrowid
            conn.commit()

        calendar_sync = sync_google_calendar_item(user_id, item_id)
        return jsonify({
            "success": True,
            "message": "Item adicionado com sucesso!",
            "googleCalendar": calendar_sync,
        }), 201
    except Exception as e:
        logger.error(f"Erro ao adicionar item: {e}")
        return jsonify({"error": "Falha ao adicionar item"}), 500

@fitness_bp.route('/dieta-treino/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_item(item_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title'); description = data.get('description'); time = data.get('time')
    aba = str(data.get('tipo', '')).lower()
    scheduled_at = _parse_scheduled_at(data)
    if not all([title, description, aba]):
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    tipo = 'treino' if 'treino' in aba else 'dieta'
    try:
        with get_db() as (cursor, conn):
            if scheduled_at:
                cursor.execute("""
                    UPDATE dieta_treino
                    SET title=%s, description=%s, time=%s, tipo=%s, created_at=%s, updated_at=%s
                    WHERE id=%s AND user_id=%s
                """, (title, description, time, tipo, scheduled_at, datetime.now(), item_id, user_id))
            else:
                cursor.execute("""
                    UPDATE dieta_treino
                    SET title=%s, description=%s, time=%s, tipo=%s, updated_at=%s
                    WHERE id=%s AND user_id=%s
                """, (title, description, time, tipo, datetime.now(), item_id, user_id))
            updated = cursor.rowcount
            conn.commit()
            if updated == 0:
                return jsonify({"error": "Item não encontrado"}), 404
        calendar_sync = sync_google_calendar_item(user_id, item_id)
        return jsonify({
            "success": True,
            "message": "Item atualizado com sucesso!",
            "googleCalendar": calendar_sync,
        }), 200
    except Exception as e:
        logger.error(f"Erro ao atualizar item: {e}")
        return jsonify({"error": "Falha ao atualizar item"}), 500

@fitness_bp.route('/dieta-treino/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_item(item_id):
    user_id = get_jwt_identity()
    try:
        with get_db() as (cursor, conn):
            cursor.execute("DELETE FROM dieta_treino WHERE id = %s AND user_id = %s", (item_id, user_id))
            deleted = cursor.rowcount
            conn.commit()
        if deleted == 0:
            return jsonify({"error": "Item nao encontrado"}), 404

        calendar_delete = delete_google_calendar_item(user_id, item_id)
        return jsonify({
            "success": True,
            "message": "Item excluido com sucesso!",
            "googleCalendar": calendar_delete,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
