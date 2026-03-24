const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'eturns.db');

let dbInstance;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

function initialize() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      area_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (area_id) REFERENCES areas(id)
    );

    CREATE TABLE IF NOT EXISTS turn_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      turn_type_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      current_area_id INTEGER,
      is_preferential INTEGER DEFAULT 0,
      sub_type TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (turn_type_id) REFERENCES turn_types(id),
      FOREIGN KEY (current_area_id) REFERENCES areas(id)
    );

    CREATE TABLE IF NOT EXISTS turn_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id INTEGER NOT NULL,
      area_id INTEGER NOT NULL,
      operator_id INTEGER,
      action TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (turn_id) REFERENCES turns(id),
      FOREIGN KEY (area_id) REFERENCES areas(id),
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default areas
  const areaCount = db.prepare('SELECT COUNT(*) as c FROM areas').get();
  if (areaCount.c === 0) {
    const insertArea = db.prepare('INSERT INTO areas (name, display_order) VALUES (?, ?)');
    insertArea.run('Facturación', 1);
    insertArea.run('Toma de Muestra', 2);
  }

  // Seed default turn types
  const typeCount = db.prepare('SELECT COUNT(*) as c FROM turn_types').get();
  if (typeCount.c === 0) {
    const insertType = db.prepare('INSERT INTO turn_types (name, prefix, display_order) VALUES (?, ?, ?)');
    insertType.run('Asegurado', 'A', 1);
    insertType.run('No Asegurado', 'N', 2);
    insertType.run('Entrega de Resultados', 'E', 3);
    insertType.run('Toma de Muestra', 'T', 4);
    insertType.run('Pre-Empleo', 'P', 5);
    insertType.run('Turno Preferencial', 'PR', 6);
  }

  // Seed default config
  const cfgCount = db.prepare('SELECT COUNT(*) as c FROM config').get();
  if (cfgCount.c === 0) {
    const insertCfg = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
    insertCfg.run('kiosk_bg_color', '#0d6efd');
    insertCfg.run('kiosk_btn_color', '#ffffff');
    insertCfg.run('kiosk_text_color', '#ffffff');
    insertCfg.run('kiosk_btn_text_color', '#0d6efd');
    insertCfg.run('display_bg_color', '#1a1a2e');
    insertCfg.run('display_text_color', '#ffffff');
    insertCfg.run('display_highlight_color', '#e94560');
    insertCfg.run('display_header_color', '#16213e');
    insertCfg.run('display_message', 'Bienvenido a nuestro centro de atención');
    insertCfg.run('display_schedule', 'Lunes a Viernes: 7:00 AM - 5:00 PM | Sábado: 7:00 AM - 12:00 PM');
    insertCfg.run('display_video_url', '');
    insertCfg.run('display_youtube_url', '');
    insertCfg.run('display_youtube_enabled', 'false');
    insertCfg.run('display_video_enabled', 'false');
    insertCfg.run('branch_name', 'Sucursal Principal');
  }

  // Seed default operator
  const opCount = db.prepare('SELECT COUNT(*) as c FROM operators').get();
  if (opCount.c === 0) {
    const facArea = db.prepare('SELECT id FROM areas WHERE name = ?').get('Facturación');
    const tmArea = db.prepare('SELECT id FROM areas WHERE name = ?').get('Toma de Muestra');
    const insertOp = db.prepare('INSERT INTO operators (name, username, area_id) VALUES (?, ?, ?)');
    if (facArea) insertOp.run('Operador Facturación', 'facturacion1', facArea.id);
    if (tmArea) insertOp.run('Operador Toma de Muestra', 'tomamuestra1', tmArea.id);
  }

  return db;
}

module.exports = {
  getDb,
  initialize,
  // Helper methods
  getAllAreas() {
    return getDb().prepare('SELECT * FROM areas WHERE active = 1 ORDER BY display_order').all();
  },
  getAllTurnTypes() {
    return getDb().prepare('SELECT * FROM turn_types WHERE active = 1 ORDER BY display_order').all();
  },
  getAllOperators() {
    return getDb().prepare(`
      SELECT o.*, a.name as area_name 
      FROM operators o 
      LEFT JOIN areas a ON o.area_id = a.id 
      WHERE o.active = 1 
      ORDER BY o.name
    `).all();
  },
  getConfig() {
    const rows = getDb().prepare('SELECT key, value FROM config').all();
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  },
  setConfig(key, value) {
    getDb().prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
  },
  createTurn(turnTypeId, isPreferential, subType) {
    const db = getDb();
    const turnType = db.prepare('SELECT * FROM turn_types WHERE id = ?').get(turnTypeId);
    if (!turnType) throw new Error('Invalid turn type');

    // Get next number for today
    const today = new Date().toISOString().split('T')[0];
    const lastTurn = db.prepare(`
      SELECT code FROM turns 
      WHERE code LIKE ? AND date(created_at) = date('now','localtime')
      ORDER BY id DESC LIMIT 1
    `).get(turnType.prefix + '%');

    let nextNum = 1;
    if (lastTurn) {
      const numPart = lastTurn.code.replace(turnType.prefix, '');
      nextNum = parseInt(numPart, 10) + 1;
    }

    const code = turnType.prefix + String(nextNum).padStart(3, '0');

    const result = db.prepare(`
      INSERT INTO turns (code, turn_type_id, status, is_preferential, sub_type)
      VALUES (?, ?, 'waiting', ?, ?)
    `).run(code, turnTypeId, isPreferential ? 1 : 0, subType || null);

    const turn = db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    // Add to history
    const firstArea = db.prepare('SELECT id FROM areas WHERE active = 1 ORDER BY display_order LIMIT 1').get();
    if (firstArea) {
      db.prepare(`
        INSERT INTO turn_history (turn_id, area_id, action)
        VALUES (?, ?, 'created')
      `).run(turn.id, firstArea.id);
    }

    return turn;
  },
  getTurnsByStatus(status, areaId) {
    const db = getDb();
    let query = `
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.status = ? AND date(t.created_at) = date('now','localtime')
    `;
    const params = [status];
    if (areaId) {
      query += ' AND t.current_area_id = ?';
      params.push(areaId);
    }
    query += ' ORDER BY t.is_preferential DESC, t.created_at ASC';
    return db.prepare(query).all(...params);
  },
  getTodayTurns() {
    return getDb().prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE date(t.created_at) = date('now','localtime')
      ORDER BY t.created_at DESC
    `).all();
  },
  getKanbanData() {
    const db = getDb();
    const areas = this.getAllAreas();
    const kanban = {};

    // Waiting (no area assigned yet)
    kanban['waiting'] = db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.status = 'waiting' AND date(t.created_at) = date('now','localtime')
      ORDER BY t.is_preferential DESC, t.created_at ASC
    `).all();

    // For each area, get turns being attended and waiting for next area
    for (const area of areas) {
      kanban['area_' + area.id + '_attending'] = db.prepare(`
        SELECT t.*, tt.name as type_name, tt.prefix
        FROM turns t
        JOIN turn_types tt ON t.turn_type_id = tt.id
        WHERE t.status = 'attending' AND t.current_area_id = ?
        AND date(t.created_at) = date('now','localtime')
        ORDER BY t.is_preferential DESC, t.created_at ASC
      `).all(area.id);

      kanban['area_' + area.id + '_waiting'] = db.prepare(`
        SELECT t.*, tt.name as type_name, tt.prefix
        FROM turns t
        JOIN turn_types tt ON t.turn_type_id = tt.id
        WHERE t.status = 'waiting_area' AND t.current_area_id = ?
        AND date(t.created_at) = date('now','localtime')
        ORDER BY t.is_preferential DESC, t.created_at ASC
      `).all(area.id);
    }

    // Completed
    kanban['completed'] = db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.status = 'completed' AND date(t.created_at) = date('now','localtime')
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all();

    return { areas, kanban };
  },
  callTurn(turnId, areaId, operatorId) {
    const db = getDb();
    db.prepare(`
      UPDATE turns SET status = 'attending', current_area_id = ?
      WHERE id = ?
    `).run(areaId, turnId);

    db.prepare(`
      INSERT INTO turn_history (turn_id, area_id, operator_id, action)
      VALUES (?, ?, ?, 'called')
    `).run(turnId, areaId, operatorId);

    return db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix, a.name as area_name
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      LEFT JOIN areas a ON t.current_area_id = a.id
      WHERE t.id = ?
    `).get(turnId);
  },
  transferTurn(turnId, toAreaId, operatorId) {
    const db = getDb();
    db.prepare(`
      UPDATE turns SET status = 'waiting_area', current_area_id = ?
      WHERE id = ?
    `).run(toAreaId, turnId);

    db.prepare(`
      INSERT INTO turn_history (turn_id, area_id, operator_id, action)
      VALUES (?, ?, ?, 'transferred')
    `).run(turnId, toAreaId, operatorId);

    return db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix, a.name as area_name
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      LEFT JOIN areas a ON t.current_area_id = a.id
      WHERE t.id = ?
    `).get(turnId);
  },
  completeTurn(turnId, operatorId) {
    const db = getDb();
    const turn = db.prepare('SELECT * FROM turns WHERE id = ?').get(turnId);
    if (!turn) throw new Error('Turn not found');

    db.prepare(`
      UPDATE turns SET status = 'completed'
      WHERE id = ?
    `).run(turnId);

    db.prepare(`
      INSERT INTO turn_history (turn_id, area_id, operator_id, action)
      VALUES (?, ?, ?, 'completed')
    `).run(turnId, turn.current_area_id, operatorId);

    return db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.id = ?
    `).get(turnId);
  },
  cancelTurn(turnId, operatorId) {
    const db = getDb();
    const turn = db.prepare('SELECT * FROM turns WHERE id = ?').get(turnId);
    if (!turn) throw new Error('Turn not found');

    db.prepare(`
      UPDATE turns SET status = 'cancelled'
      WHERE id = ?
    `).run(turnId);

    const areaId = turn.current_area_id
      || db.prepare('SELECT id FROM areas WHERE active = 1 ORDER BY display_order LIMIT 1').get()?.id
      || null;

    if (areaId) {
      db.prepare(`
        INSERT INTO turn_history (turn_id, area_id, operator_id, action)
        VALUES (?, ?, ?, 'cancelled')
      `).run(turnId, areaId, operatorId);
    }

    return db.prepare(`
      SELECT t.*, tt.name as type_name, tt.prefix
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.id = ?
    `).get(turnId);
  },
  getStatsData(startDate, endDate) {
    const db = getDb();
    return db.prepare(`
      SELECT 
        t.id,
        t.code,
        tt.name as turn_type,
        t.is_preferential,
        t.sub_type,
        t.status,
        t.created_at as arrival_time,
        (SELECT th.timestamp FROM turn_history th WHERE th.turn_id = t.id AND th.action = 'called' AND th.area_id = (SELECT id FROM areas WHERE name = 'Facturación' LIMIT 1) LIMIT 1) as called_facturacion_time,
        (SELECT o.name FROM turn_history th JOIN operators o ON th.operator_id = o.id WHERE th.turn_id = t.id AND th.action = 'called' AND th.area_id = (SELECT id FROM areas WHERE name = 'Facturación' LIMIT 1) LIMIT 1) as operator_facturacion,
        (SELECT th.timestamp FROM turn_history th WHERE th.turn_id = t.id AND th.action = 'called' AND th.area_id = (SELECT id FROM areas WHERE name = 'Toma de Muestra' LIMIT 1) LIMIT 1) as called_toma_time,
        (SELECT o.name FROM turn_history th JOIN operators o ON th.operator_id = o.id WHERE th.turn_id = t.id AND th.action = 'called' AND th.area_id = (SELECT id FROM areas WHERE name = 'Toma de Muestra' LIMIT 1) LIMIT 1) as operator_toma,
        (SELECT th.timestamp FROM turn_history th WHERE th.turn_id = t.id AND th.action = 'completed' LIMIT 1) as completed_time
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE date(t.created_at) BETWEEN ? AND ?
      ORDER BY t.created_at ASC
    `).all(startDate, endDate);
  },
  getDisplayData() {
    const db = getDb();
    // Current turn being called (most recent)
    const currentTurns = db.prepare(`
      SELECT t.code, a.name as area_name, o.name as operator_name
      FROM turn_history th
      JOIN turns t ON th.turn_id = t.id
      JOIN areas a ON th.area_id = a.id
      LEFT JOIN operators o ON th.operator_id = o.id
      WHERE th.action = 'called' AND date(th.timestamp) = date('now','localtime')
      AND t.status = 'attending'
      ORDER BY th.timestamp DESC
      LIMIT 5
    `).all();

    // Waiting turns
    const waitingTurns = db.prepare(`
      SELECT t.code, tt.name as type_name
      FROM turns t
      JOIN turn_types tt ON t.turn_type_id = tt.id
      WHERE t.status = 'waiting' AND date(t.created_at) = date('now','localtime')
      ORDER BY t.is_preferential DESC, t.created_at ASC
    `).all();

    return { currentTurns, waitingTurns };
  },
  getLastCalledTurn() {
    return getDb().prepare(`
      SELECT t.code, a.name as area_name, o.name as operator_name, th.timestamp
      FROM turn_history th
      JOIN turns t ON th.turn_id = t.id
      JOIN areas a ON th.area_id = a.id
      LEFT JOIN operators o ON th.operator_id = o.id
      WHERE th.action = 'called' AND date(th.timestamp) = date('now','localtime')
      ORDER BY th.timestamp DESC
      LIMIT 1
    `).get();
  }
};
