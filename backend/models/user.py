import bcrypt
from database import get_db


def get_all_usuarios():
    db = get_db()
    try:
        rows = db.execute("""
            SELECT u.id, u.nombre, u.email, u.rol,
                   u.ventanilla_id, v.nombre AS ventanilla_nombre,
                   u.activo, u.created_at
            FROM usuarios u
            LEFT JOIN ventanillas v ON u.ventanilla_id = v.id
            ORDER BY u.id
        """).fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()


def get_usuario_by_id(user_id):
    db = get_db()
    try:
        row = db.execute("""
            SELECT u.id, u.nombre, u.email, u.rol,
                   u.ventanilla_id, v.nombre AS ventanilla_nombre,
                   u.activo, u.created_at
            FROM usuarios u
            LEFT JOIN ventanillas v ON u.ventanilla_id = v.id
            WHERE u.id = ?
        """, (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        db.close()


def create_usuario(nombre, email, password, rol='operador', ventanilla_id=None):
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol, ventanilla_id) VALUES (?, ?, ?, ?, ?)",
            (nombre, email, password_hash, rol, ventanilla_id)
        )
        db.commit()
        new_id = cursor.lastrowid
    finally:
        db.close()
    return get_usuario_by_id(new_id)


def update_nombre(user_id, nombre):
    db = get_db()
    try:
        db.execute("UPDATE usuarios SET nombre = ? WHERE id = ?", (nombre, user_id))
        db.commit()
    finally:
        db.close()
    return get_usuario_by_id(user_id)


def update_password(user_id, new_password):
    password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db = get_db()
    try:
        db.execute("UPDATE usuarios SET password_hash = ? WHERE id = ?", (password_hash, user_id))
        db.commit()
    finally:
        db.close()


def update_rol(user_id, rol):
    db = get_db()
    try:
        db.execute("UPDATE usuarios SET rol = ? WHERE id = ?", (rol, user_id))
        db.commit()
    finally:
        db.close()
    return get_usuario_by_id(user_id)


def update_ventanilla(user_id, ventanilla_id):
    db = get_db()
    try:
        db.execute("UPDATE usuarios SET ventanilla_id = ? WHERE id = ?", (ventanilla_id, user_id))
        db.commit()
    finally:
        db.close()
    return get_usuario_by_id(user_id)


def update_estado(user_id, activo):
    db = get_db()
    try:
        db.execute("UPDATE usuarios SET activo = ? WHERE id = ?", (1 if activo else 0, user_id))
        db.commit()
    finally:
        db.close()
    return get_usuario_by_id(user_id)


def get_all_ventanillas():
    db = get_db()
    try:
        rows = db.execute("SELECT id, nombre, descripcion FROM ventanillas ORDER BY id").fetchall()
        return [dict(r) for r in rows]
    finally:
        db.close()
