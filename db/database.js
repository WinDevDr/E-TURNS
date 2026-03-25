const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'e-turns.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      prefijo TEXT NOT NULL,
      color TEXT DEFAULT '#0d6efd',
      logo_url TEXT
    )`);

    // Intentar agregar columna logo_url a areas si no existe (para BDs ya creadas)
    db.run(`ALTER TABLE areas ADD COLUMN logo_url TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      area TEXT NOT NULL,
      ventanilla TEXT DEFAULT '',
      estado TEXT DEFAULT 'esperando',
      fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_atendido DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL,
      valor TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'operador',
      nombre TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ventanillas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario_id INTEGER,
      area_id INTEGER,
      activa INTEGER DEFAULT 1,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    // Insertar áreas por defecto si no existen
    const configPath = path.join(__dirname, '..', 'config', 'config.json');
    const config = require(configPath);

    // Sembrar áreas por defecto si no existen (idempotente por nombre)
    config.areas.forEach(area => {
      db.run(
        'INSERT INTO areas (nombre, prefijo, color) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = ?)',
        [area.nombre, area.prefijo, area.color, area.nombre]
      );
    });

    // Insertar configuración por defecto si no existe
    db.get('SELECT COUNT(*) as count FROM configuracion', (err, row) => {
      if (!err && row.count === 0) {
        const hospital = config.hospital;
        const stmt = db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)');
        Object.entries(hospital).forEach(([clave, valor]) => {
          stmt.run(clave, String(valor));
        });
        stmt.finalize();
      }
    });

    // Sembrar usuarios por defecto
    db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
      if (!err && row.count === 0) {
        const saltRounds = 10;
        bcrypt.hash('admin123', saltRounds, (err, hashAdmin) => {
          if (err) return;
          bcrypt.hash('op123', saltRounds, (err, hashOp) => {
            if (err) return;
            db.run(
              'INSERT INTO usuarios (username, password, rol, nombre) VALUES (?, ?, ?, ?)',
              ['adiaz', hashAdmin, 'admin', 'Ana Diaz'],
              () => {}
            );
            db.run(
              'INSERT INTO usuarios (username, password, rol, nombre) VALUES (?, ?, ?, ?)',
              ['jperez', hashOp, 'operador', 'Juan Perez'],
              () => {}
            );
          });
        });
      }
    });

    // Sembrar ventanillas por defecto
    db.get('SELECT COUNT(*) as count FROM ventanillas', (err, row) => {
      if (!err && row.count === 0) {
        const stmt = db.prepare('INSERT INTO ventanillas (nombre) VALUES (?)');
        [
          'Facturación Puesto 1', 'Facturación Puesto 2', 'Facturación Puesto 3',
          'Toma de Muestra 1', 'Toma de Muestra 2', 'Toma de Muestra 3'
        ].forEach(nombre => {
          stmt.run(nombre);
        });
        stmt.finalize();
      }
    });

    // Nuevas columnas en turnos (ALTER TABLE ignora error si la columna ya existe)
    const turnosCols = [
      `ALTER TABLE turnos ADD COLUMN tipo_paciente TEXT`,
      `ALTER TABLE turnos ADD COLUMN etapa TEXT DEFAULT 'espera_sala'`,
      `ALTER TABLE turnos ADD COLUMN preferencial INTEGER DEFAULT 0`,
      `ALTER TABLE turnos ADD COLUMN llamado_por TEXT`,
      `ALTER TABLE turnos ADD COLUMN atendido_por_facturacion TEXT`,
      `ALTER TABLE turnos ADD COLUMN fecha_llamado_facturacion DATETIME`,
      `ALTER TABLE turnos ADD COLUMN atendido_por_muestra TEXT`,
      `ALTER TABLE turnos ADD COLUMN fecha_llamado_muestra DATETIME`,
      `ALTER TABLE turnos ADD COLUMN sucursal_id INTEGER`
    ];
    turnosCols.forEach(sql => db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.warn('[DB] Advertencia migración:', err.message);
      }
    }));

    // Tabla de sucursales
    db.run(`CREATE TABLE IF NOT EXISTS sucursales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      activa INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sucursal_usuarios (
      sucursal_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      PRIMARY KEY (sucursal_id, usuario_id),
      FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    // Sembrar sucursal por defecto
    db.get('SELECT COUNT(*) as count FROM sucursales', (err, row) => {
      if (!err && row.count === 0) {
        db.run("INSERT INTO sucursales (nombre) VALUES ('Sucursal Principal')");
      }
    });

    // Tabla de tipos de atención del kiosco
    db.run(`CREATE TABLE IF NOT EXISTS tipos_kiosco (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      color TEXT DEFAULT '#FF8500',
      orden INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1
    )`);

    // Sembrar tipos de kiosco por defecto si no existen
    db.get('SELECT COUNT(*) as count FROM tipos_kiosco', (err, row) => {
      if (!err && row.count === 0) {
        const tiposDefault = [
          { nombre: 'Asegurado', color: '#FF8500', orden: 1 },
          { nombre: 'No Asegurado', color: '#d4730a', orden: 2 },
          { nombre: 'Entrega de Resultados', color: '#e06000', orden: 3 },
          { nombre: 'Toma de Muestra', color: '#b35900', orden: 4 },
          { nombre: 'Pre-Empleo', color: '#ff9d33', orden: 5 }
        ];
        const stmt = db.prepare('INSERT INTO tipos_kiosco (nombre, color, orden) VALUES (?, ?, ?)');
        tiposDefault.forEach(t => stmt.run(t.nombre, t.color, t.orden));
        stmt.finalize();
      }
    });
  });
}

module.exports = db;
