const express = require('express');
const router = express.Router();
const db = require('../db/database');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Sanitizar ID numérico para evitar path traversal
function sanitizeNumericId(id) {
  const num = parseInt(id, 10);
  if (isNaN(num) || num <= 0) return null;
  return String(num);
}

// Configuración multer para logo del sistema
const storageLogoSistema = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'logo');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  }
});

// Configuración multer para logos de áreas
const storageLogoArea = multer.diskStorage({
  destination: (req, file, cb) => {
    const safeId = sanitizeNumericId(req.params.id);
    if (!safeId) return cb(new Error('ID de área inválido.'));
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'areas', safeId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  }
});

function fileFilter(req, file, cb) {
  // SVG excluido por riesgo de XSS (puede contener JavaScript)
  const allowed = /^(jpeg|jpg|png|gif|webp)$/;
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp).'));
  }
}

const uploadLogoSistema = multer({ storage: storageLogoSistema, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadLogoArea = multer({ storage: storageLogoArea, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/turnos
router.get('/turnos', (req, res) => {
  const incluirCancelados = req.query.incluir_cancelados === 'true';
  const sql = incluirCancelados
    ? 'SELECT * FROM turnos ORDER BY fecha_hora ASC'
    : "SELECT * FROM turnos WHERE estado != 'cancelado' ORDER BY fecha_hora ASC";
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/turnos — crear nuevo turno
router.post('/turnos', (req, res) => {
  const { area } = req.body;
  if (!area) return res.status(400).json({ error: 'El campo area es requerido.' });

  // Obtener prefijo del área
  db.get('SELECT prefijo FROM areas WHERE nombre = ?', [area], (err, areaRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!areaRow) return res.status(404).json({ error: 'Área no encontrada.' });

    const prefijo = areaRow.prefijo;
    const hoy = new Date().toISOString().split('T')[0];

    // Contar turnos del día para esta área
    db.get(
      `SELECT COUNT(*) as count FROM turnos WHERE area = ? AND DATE(fecha_hora) = ?`,
      [area, hoy],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const siguiente = (row.count || 0) + 1;
        const numero = `${prefijo}${String(siguiente).padStart(2, '0')}`;

        db.run(
          'INSERT INTO turnos (numero, area, estado) VALUES (?, ?, ?)',
          [numero, area, 'esperando'],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM turnos WHERE id = ?', [this.lastID], (err, turno) => {
              if (err) return res.status(500).json({ error: err.message });
              res.status(201).json(turno);
            });
          }
        );
      }
    );
  });
});

// PUT /api/turnos/:id/llamar
router.put('/turnos/:id/llamar', (req, res) => {
  const { id } = req.params;
  const { ventanilla } = req.body;

  db.run(
    'UPDATE turnos SET estado = ?, ventanilla = ? WHERE id = ?',
    ['llamado', ventanilla || '', id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Turno no encontrado.' });
      db.get('SELECT * FROM turnos WHERE id = ?', [id], (err, turno) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(turno);
      });
    }
  );
});

// PUT /api/turnos/:id/atender
router.put('/turnos/:id/atender', (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE turnos SET estado = ?, fecha_atendido = CURRENT_TIMESTAMP WHERE id = ?',
    ['atendido', id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Turno no encontrado.' });
      db.get('SELECT * FROM turnos WHERE id = ?', [id], (err, turno) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(turno);
      });
    }
  );
});

// PUT /api/turnos/:id/cancelar
router.put('/turnos/:id/cancelar', requireAuth, (req, res) => {
  const { id } = req.params;

  db.run(
    "UPDATE turnos SET estado = 'cancelado' WHERE id = ? AND estado != 'atendido'",
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Turno no encontrado o ya atendido.' });
      db.get('SELECT * FROM turnos WHERE id = ?', [id], (err, turno) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(turno);
      });
    }
  );
});

// PUT /api/turnos/:id/transferir
router.put('/turnos/:id/transferir', requireAuth, (req, res) => {
  const { id } = req.params;
  const { area } = req.body;
  if (!area) return res.status(400).json({ error: 'El campo area es requerido.' });

  db.get('SELECT id FROM areas WHERE nombre = ?', [area], (err, areaRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!areaRow) return res.status(404).json({ error: 'Área destino no encontrada.' });

    db.run(
      "UPDATE turnos SET area = ?, estado = 'esperando', ventanilla = '' WHERE id = ? AND estado != 'atendido' AND estado != 'cancelado'",
      [area, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Turno no encontrado o no transferible.' });
        db.get('SELECT * FROM turnos WHERE id = ?', [id], (err, turno) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(turno);
        });
      }
    );
  });
});

// GET /api/areas
router.get('/areas', (req, res) => {
  db.all('SELECT * FROM areas ORDER BY nombre ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/areas
router.post('/areas', requireAuth, requireAdmin, (req, res) => {
  const { nombre, prefijo, color } = req.body;
  if (!nombre || !prefijo) return res.status(400).json({ error: 'nombre y prefijo son requeridos.' });

  db.run(
    'INSERT INTO areas (nombre, prefijo, color) VALUES (?, ?, ?)',
    [nombre, prefijo, color || '#0d6efd'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM areas WHERE id = ?', [this.lastID], (err, area) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json(area);
      });
    }
  );
});

// PUT /api/areas/:id/logo — subir logo de área
router.put('/areas/:id/logo', requireAuth, requireAdmin, uploadLogoArea.single('logo'), (req, res) => {
  const safeId = sanitizeNumericId(req.params.id);
  if (!safeId) return res.status(400).json({ error: 'ID de área inválido.' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });

  const logoUrl = `/uploads/areas/${safeId}/${req.file.filename}`;
  db.run('UPDATE areas SET logo_url = ? WHERE id = ?', [logoUrl, safeId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Área no encontrada.' });
    res.json({ mensaje: 'Logo actualizado correctamente.', logo_url: logoUrl });
  });
});

// DELETE /api/areas/:id — eliminar área
router.delete('/areas/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM areas WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Área no encontrada.' });
    res.json({ mensaje: 'Área eliminada correctamente.' });
  });
});

// GET /api/ventanillas
router.get('/ventanillas', requireAuth, (req, res) => {
  db.all(
    `SELECT v.*, u.username, u.nombre as usuario_nombre
     FROM ventanillas v
     LEFT JOIN usuarios u ON v.usuario_id = u.id
     ORDER BY v.id ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST /api/ventanillas
router.post('/ventanillas', requireAuth, requireAdmin, (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

  db.run('INSERT INTO ventanillas (nombre) VALUES (?)', [nombre], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(
      `SELECT v.*, u.username, u.nombre as usuario_nombre
       FROM ventanillas v LEFT JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.id = ?`,
      [this.lastID],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json(row);
      }
    );
  });
});

// PUT /api/ventanillas/:id — actualizar nombre
router.put('/ventanillas/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

  db.run('UPDATE ventanillas SET nombre = ? WHERE id = ?', [nombre, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Ventanilla no encontrada.' });
    res.json({ mensaje: 'Ventanilla actualizada correctamente.' });
  });
});

// PUT /api/ventanillas/:id/usuario — asignar usuario
router.put('/ventanillas/:id/usuario', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;

  db.run('UPDATE ventanillas SET usuario_id = ? WHERE id = ?', [usuario_id || null, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Ventanilla no encontrada.' });
    res.json({ mensaje: 'Usuario asignado correctamente.' });
  });
});

// DELETE /api/ventanillas/:id
router.delete('/ventanillas/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM ventanillas WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Ventanilla no encontrada.' });
    res.json({ mensaje: 'Ventanilla eliminada correctamente.' });
  });
});

// GET /api/usuarios — listar todos los usuarios (admin y operador)
router.get('/usuarios', requireAuth, requireAdmin, (req, res) => {
  db.all('SELECT id, username, nombre, rol FROM usuarios ORDER BY nombre ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/operadores — listar operadores (para asignación de ventanillas)
router.get('/operadores', requireAuth, requireAdmin, (req, res) => {
  db.all("SELECT id, username, nombre, rol FROM usuarios WHERE rol = 'operador' ORDER BY nombre ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/usuarios — crear usuario
router.post('/usuarios', requireAuth, requireAdmin, (req, res) => {
  const { nombre, username, password, rol } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'El username es requerido.' });
  if (!password) return res.status(400).json({ error: 'La contraseña es requerida.' });
  if (!rol || !['admin', 'operador'].includes(rol)) return res.status(400).json({ error: 'El rol debe ser admin u operador.' });

  db.get('SELECT id FROM usuarios WHERE username = ?', [username.trim()], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'El username ya está en uso.' });

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: 'Error al procesar la contraseña.' });
      db.run(
        'INSERT INTO usuarios (username, password, rol, nombre) VALUES (?, ?, ?, ?)',
        [username.trim(), hash, rol, nombre ? nombre.trim() : ''],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: this.lastID, username: username.trim(), nombre: nombre ? nombre.trim() : '', rol });
        }
      );
    });
  });
});

// PUT /api/usuarios/:id — editar nombre, username y rol
router.put('/usuarios/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre, username, rol } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'El username es requerido.' });
  if (!rol || !['admin', 'operador'].includes(rol)) return res.status(400).json({ error: 'El rol debe ser admin u operador.' });

  db.get('SELECT id FROM usuarios WHERE username = ? AND id != ?', [username.trim(), id], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'El username ya está en uso por otro usuario.' });

    db.run(
      'UPDATE usuarios SET nombre = ?, username = ?, rol = ? WHERE id = ?',
      [nombre ? nombre.trim() : '', username.trim(), rol, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json({ mensaje: 'Usuario actualizado correctamente.' });
      }
    );
  });
});

// PUT /api/usuarios/:id/password — cambiar contraseña
router.put('/usuarios/:id/password', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'La contraseña es requerida.' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Error al procesar la contraseña.' });
    db.run('UPDATE usuarios SET password = ? WHERE id = ?', [hash, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
      res.json({ mensaje: 'Contraseña actualizada correctamente.' });
    });
  });
});

// DELETE /api/usuarios/:id — eliminar usuario (no puede eliminarse a sí mismo)
router.delete('/usuarios/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (String(req.session.userId) === String(id)) {
    return res.status(403).json({ error: 'No puedes eliminar tu propio usuario.' });
  }
  db.run('DELETE FROM usuarios WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ mensaje: 'Usuario eliminado correctamente.' });
  });
});

// PUT /api/config/logo — subir logo del sistema
router.put('/config/logo', requireAuth, requireAdmin, uploadLogoSistema.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });

  const logoUrl = `/uploads/logo/${req.file.filename}`;
  const stmt = db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  stmt.run('logo_url', logoUrl);
  stmt.run('logo', logoUrl);
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Logo actualizado correctamente.', logo_url: logoUrl });
  });
});

// GET /api/config
router.get('/config', (req, res) => {
  db.all('SELECT clave, valor FROM configuracion', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    rows.forEach(r => { config[r.clave] = r.valor; });
    res.json(config);
  });
});

// PUT /api/config
router.put('/config', (req, res) => {
  const datos = req.body;
  const stmt = db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  Object.entries(datos).forEach(([clave, valor]) => {
    stmt.run(clave, String(valor));
  });
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Configuración actualizada correctamente.' });
  });
});

// GET /api/stats
router.get('/stats', (req, res) => {  const hoy = new Date().toISOString().split('T')[0];

  const queries = {
    atendidos: `SELECT COUNT(*) as total FROM turnos WHERE estado = 'atendido' AND DATE(fecha_hora) = ?`,
    enEspera: `SELECT COUNT(*) as total FROM turnos WHERE estado = 'esperando' AND DATE(fecha_hora) = ?`,
    porArea: `SELECT area, COUNT(*) as total FROM turnos WHERE DATE(fecha_hora) = ? GROUP BY area ORDER BY total DESC`,
    porHora: `SELECT strftime('%H', fecha_hora) as hora, COUNT(*) as total FROM turnos WHERE DATE(fecha_hora) = ? GROUP BY hora ORDER BY hora ASC`,
    tiempoPromedio: `
      SELECT AVG((julianday(fecha_atendido) - julianday(fecha_hora)) * 24 * 60) as promedio
      FROM turnos
      WHERE estado = 'atendido' AND fecha_atendido IS NOT NULL AND DATE(fecha_hora) = ?
    `
  };

  const resultado = {};
  let pendientes = Object.keys(queries).length;

  Object.entries(queries).forEach(([clave, sql]) => {
    if (clave === 'porArea' || clave === 'porHora') {
      db.all(sql, [hoy], (err, rows) => {
        resultado[clave] = err ? [] : rows;
        if (--pendientes === 0) res.json(resultado);
      });
    } else {
      db.get(sql, [hoy], (err, row) => {
        resultado[clave] = err ? null : (row ? (row.total !== undefined ? row.total : row.promedio) : 0);
        if (--pendientes === 0) res.json(resultado);
      });
    }
  });
});

// ===================== SUCURSALES =====================

// GET /api/sucursales — listar sucursales con usuarios asignados
router.get('/sucursales', requireAuth, requireAdmin, (req, res) => {
  db.all('SELECT * FROM sucursales ORDER BY nombre ASC', (err, sucursales) => {
    if (err) return res.status(500).json({ error: err.message });
    if (sucursales.length === 0) return res.json([]);

    const queries = sucursales.map(s => new Promise((resolve, reject) => {
      db.all(
        `SELECT u.id, u.username, u.nombre, u.rol
         FROM sucursal_usuarios su
         JOIN usuarios u ON su.usuario_id = u.id
         WHERE su.sucursal_id = ?`,
        [s.id],
        (err, usuarios) => {
          if (err) return reject(err);
          resolve({ ...s, usuarios });
        }
      );
    }));

    Promise.all(queries)
      .then(resultado => res.json(resultado))
      .catch(e => res.status(500).json({ error: e.message }));
  });
});

// POST /api/sucursales — crear sucursal
router.post('/sucursales', requireAuth, requireAdmin, (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });

  db.run('INSERT INTO sucursales (nombre) VALUES (?)', [nombre.trim()], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM sucursales WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      row.usuarios = [];
      res.status(201).json(row);
    });
  });
});

// PUT /api/sucursales/:id — renombrar sucursal
router.put('/sucursales/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });

  db.run('UPDATE sucursales SET nombre = ? WHERE id = ?', [nombre.trim(), id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Sucursal no encontrada.' });
    res.json({ mensaje: 'Sucursal actualizada correctamente.' });
  });
});

// PUT /api/sucursales/:id/usuarios — asignar usuarios a la sucursal (reemplaza asignación anterior)
router.put('/sucursales/:id/usuarios', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { usuario_ids } = req.body;
  if (!Array.isArray(usuario_ids)) return res.status(400).json({ error: 'usuario_ids debe ser un array.' });

  db.get('SELECT id FROM sucursales WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Sucursal no encontrada.' });

    db.run('DELETE FROM sucursal_usuarios WHERE sucursal_id = ?', [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      if (usuario_ids.length === 0) return res.json({ mensaje: 'Personal actualizado correctamente.' });

      const stmt = db.prepare('INSERT OR IGNORE INTO sucursal_usuarios (sucursal_id, usuario_id) VALUES (?, ?)');
      usuario_ids.forEach(uid => stmt.run(id, uid));
      stmt.finalize((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Personal actualizado correctamente.' });
      });
    });
  });
});

// DELETE /api/sucursales/:id — eliminar sucursal
router.delete('/sucursales/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM sucursal_usuarios WHERE sucursal_id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run('DELETE FROM sucursales WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Sucursal no encontrada.' });
      res.json({ mensaje: 'Sucursal eliminada correctamente.' });
    });
  });
});

module.exports = router;

