-- E-TURNS: Sistema de Turnos
-- Esquema de base de datos

CREATE TABLE IF NOT EXISTS ventanillas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) DEFAULT 'operador',  -- admin | operador | supervisor
    ventanilla_id INTEGER REFERENCES ventanillas(id),
    activo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos de prueba: ventanillas
INSERT OR IGNORE INTO ventanillas (id, nombre, descripcion) VALUES
    (1, 'Ventanilla 1', 'Atención general'),
    (2, 'Ventanilla 2', 'Trámites especiales'),
    (3, 'Ventanilla 3', 'Cobros y pagos');

-- Datos de prueba: usuarios (passwords hasheadas con bcrypt)
-- admin123 / operador123 / supervisor123
INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, rol, ventanilla_id, activo) VALUES
    (1, 'Administrador', 'admin@eturns.com',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgRdyWV4XPi1fk/tbL.M7S',
        'admin', NULL, 1),
    (2, 'Juan Pérez', 'juan@eturns.com',
        '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'operador', 1, 1),
    (3, 'María García', 'maria@eturns.com',
        '$2b$12$IORnW.jB2kYQVXhUTanqPOW0MdOG1WGWiOLfmmcQsBsQOvtSYjHNu',
        'supervisor', 2, 1);
