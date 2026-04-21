import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.database import get_db, get_db_connection

logger = logging.getLogger(__name__)
fitness_bp = Blueprint('fitness', __name__)

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

    if not all([title, description, aba]):
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    tipo = 'treino' if 'treino' in aba else 'dieta'
    try:
        with get_db() as (cursor, conn):
            cursor.execute("""
                INSERT INTO dieta_treino (user_id, tipo, title, description, time)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, tipo, title, description, time))
            conn.commit()
            return jsonify({"success": True, "message": "Item adicionado com sucesso!"}), 201
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
    if not all([title, description, aba]):
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    tipo = 'treino' if 'treino' in aba else 'dieta'
    try:
        with get_db() as (cursor, conn):
            cursor.execute("""
                UPDATE dieta_treino
                SET title=%s, description=%s, time=%s, tipo=%s, updated_at=%s
                WHERE id=%s AND user_id=%s
            """, (title, description, time, tipo, datetime.now(), item_id, user_id))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Item não encontrado"}), 404
            return jsonify({"success": True, "message": "Item atualizado com sucesso!"}), 200
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
            conn.commit()
            return jsonify({"success": True, "message": "Item excluído com sucesso!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
