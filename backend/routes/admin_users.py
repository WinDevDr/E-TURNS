import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Blueprint, request, jsonify
from models.user import (
    get_all_usuarios, get_usuario_by_id, create_usuario,
    update_nombre, update_password, update_rol,
    update_ventanilla, update_estado, get_all_ventanillas
)

admin_users_bp = Blueprint('admin_users', __name__)

ROLES_VALIDOS = {'admin', 'operador', 'supervisor'}


def error(msg, code=400):
    return jsonify({'error': msg}), code


def success(data=None, msg=None):
    resp = {'success': True}
    if msg:
        resp['message'] = msg
    if data is not None:
        resp['data'] = data
    return jsonify(resp)


# GET  /api/admin/usuarios — Listar todos los usuarios
# POST /api/admin/usuarios — Crear nuevo usuario
@admin_users_bp.route('/api/admin/usuarios', methods=['GET', 'POST'])
def usuarios():
    if request.method == 'GET':
        return jsonify(get_all_usuarios())

    data = request.get_json(silent=True) or {}
    nombre = (data.get('nombre') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    rol = (data.get('rol') or 'operador').strip()
    ventanilla_id = data.get('ventanilla_id')

    if not nombre:
        return error('El nombre es requerido')
    if not email:
        return error('El email es requerido')
    if not password or len(password) < 6:
        return error('La contraseña debe tener al menos 6 caracteres')
    if rol not in ROLES_VALIDOS:
        return error(f'Rol inválido. Valores permitidos: {", ".join(ROLES_VALIDOS)}')

    try:
        usuario = create_usuario(nombre, email, password, rol, ventanilla_id or None)
        return jsonify(usuario), 201
    except Exception as e:
        if 'UNIQUE' in str(e):
            return error('Ya existe un usuario con ese email', 409)
        return error(str(e), 500)


# GET /api/admin/ventanillas — Listar ventanillas (para selectores)
@admin_users_bp.route('/api/admin/ventanillas', methods=['GET'])
def ventanillas():
    return jsonify(get_all_ventanillas())


# PUT /api/admin/usuarios/:id/nombre
@admin_users_bp.route('/api/admin/usuarios/<int:user_id>/nombre', methods=['PUT'])
def cambiar_nombre(user_id):
    if not get_usuario_by_id(user_id):
        return error('Usuario no encontrado', 404)
    data = request.get_json(silent=True) or {}
    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return error('El nombre es requerido')
    usuario = update_nombre(user_id, nombre)
    return success(usuario, 'Nombre actualizado correctamente')


# PUT /api/admin/usuarios/:id/password
@admin_users_bp.route('/api/admin/usuarios/<int:user_id>/password', methods=['PUT'])
def cambiar_password(user_id):
    if not get_usuario_by_id(user_id):
        return error('Usuario no encontrado', 404)
    data = request.get_json(silent=True) or {}
    password = data.get('password') or ''
    confirm = data.get('confirm_password') or ''
    if not password or len(password) < 6:
        return error('La contraseña debe tener al menos 6 caracteres')
    if password != confirm:
        return error('Las contraseñas no coinciden')
    update_password(user_id, password)
    return success(msg='Contraseña actualizada correctamente')


# PUT /api/admin/usuarios/:id/rol
@admin_users_bp.route('/api/admin/usuarios/<int:user_id>/rol', methods=['PUT'])
def cambiar_rol(user_id):
    if not get_usuario_by_id(user_id):
        return error('Usuario no encontrado', 404)
    data = request.get_json(silent=True) or {}
    rol = (data.get('rol') or '').strip()
    if rol not in ROLES_VALIDOS:
        return error(f'Rol inválido. Valores permitidos: {", ".join(ROLES_VALIDOS)}')
    usuario = update_rol(user_id, rol)
    return success(usuario, 'Rol actualizado correctamente')


# PUT /api/admin/usuarios/:id/ventanilla
@admin_users_bp.route('/api/admin/usuarios/<int:user_id>/ventanilla', methods=['PUT'])
def cambiar_ventanilla(user_id):
    if not get_usuario_by_id(user_id):
        return error('Usuario no encontrado', 404)
    data = request.get_json(silent=True) or {}
    ventanilla_id = data.get('ventanilla_id')
    usuario = update_ventanilla(user_id, ventanilla_id)
    return success(usuario, 'Ventanilla actualizada correctamente')


# PUT /api/admin/usuarios/:id/estado
@admin_users_bp.route('/api/admin/usuarios/<int:user_id>/estado', methods=['PUT'])
def cambiar_estado(user_id):
    if not get_usuario_by_id(user_id):
        return error('Usuario no encontrado', 404)
    data = request.get_json(silent=True) or {}
    if 'activo' not in data:
        return error('El campo activo es requerido')
    activo = bool(data['activo'])
    usuario = update_estado(user_id, activo)
    estado_txt = 'activado' if activo else 'desactivado'
    return success(usuario, f'Usuario {estado_txt} correctamente')
