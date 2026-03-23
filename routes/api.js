const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/turnos
router.get('/turnos', (req, res) => {
  db.all('SELECT * FROM turnos ORDER BY fecha_hora ASC', (err, rows) => {
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

// GET /api/areas
router.get('/areas', (req, res) => {
  db.all('SELECT * FROM areas ORDER BY nombre ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/areas
router.post('/areas', (req, res) => {
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
router.get('/stats', (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];

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

module.exports = router;
