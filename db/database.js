const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
      color TEXT DEFAULT '#0d6efd'
    )`);

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
      nombre TEXT NOT NULL,
      rol TEXT DEFAULT 'operador',
      ventanilla TEXT
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
  });
}

module.exports = db;
