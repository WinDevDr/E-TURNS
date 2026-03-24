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

    db.get('SELECT COUNT(*) as count FROM areas', (err, row) => {
      if (!err && row.count === 0) {
        const stmt = db.prepare('INSERT INTO areas (nombre, prefijo, color) VALUES (?, ?, ?)');
        config.areas.forEach(area => {
          stmt.run(area.nombre, area.prefijo, area.color);
        });
        stmt.finalize();
      }
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
        ['Ventanilla 1', 'Ventanilla 2', 'Ventanilla 3'].forEach(nombre => {
          stmt.run(nombre);
        });
        stmt.finalize();
      }
    });

    // Nuevas columnas en turnos
    db.run(`ALTER TABLE turnos ADD COLUMN tipo_paciente TEXT`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN etapa TEXT DEFAULT 'espera_sala'`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN preferencial INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN llamado_por TEXT`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN atendido_por_facturacion TEXT`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN fecha_llamado_facturacion DATETIME`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN atendido_por_muestra TEXT`, () => {});
    db.run(`ALTER TABLE turnos ADD COLUMN fecha_llamado_muestra DATETIME`, () => {});

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
  });
}

module.exports = db;
