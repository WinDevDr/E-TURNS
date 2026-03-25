const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');

const meRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente más tarde.' }
});

// POST /auth/login — paso 1: credenciales (sin rol)
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  db.get(
    'SELECT * FROM usuarios WHERE username = ?',
    [username],
    (err, usuario) => {
      if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
      if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas.' });

      bcrypt.compare(password, usuario.password, (err, coincide) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas.' });

        // Guardar credenciales validadas en sesión (sin confirmar aún la sucursal)
        req.session.userId = usuario.id;
        req.session.username = usuario.username;
        req.session.rol = usuario.rol;
        req.session.nombre = usuario.nombre;
        req.session.sucursalId = null;
        req.session.sucursalNombre = null;

        // Buscar sucursales asignadas a este usuario
        db.all(
          `SELECT s.id, s.nombre FROM sucursales s
           JOIN sucursal_usuarios su ON su.sucursal_id = s.id
           WHERE su.usuario_id = ?
           ORDER BY s.nombre ASC`,
          [usuario.id],
          (err, sucursales) => {
            if (err) sucursales = [];

            // If the usuario is admin or tiene exactamente una sucursal, asignar automáticamente
            if (usuario.rol === 'admin') {
              req.session.sucursalId = null; // admin ve todo
              return req.session.save(() => res.json({
                mensaje: 'Sesión iniciada correctamente.',
                rol: usuario.rol,
                username: usuario.username,
                nombre: usuario.nombre,
                sucursales: []
              }));
            }

            if (sucursales.length === 1) {
              req.session.sucursalId = sucursales[0].id;
              req.session.sucursalNombre = sucursales[0].nombre;
              return req.session.save((err) => {
                res.json({
                  mensaje: 'Sesión iniciada correctamente.',
                  rol: usuario.rol,
                  username: usuario.username,
                  nombre: usuario.nombre,
                  sucursales: []
                });
              });
            }

            // Múltiples sucursales → el usuario debe elegir
            res.json({
              mensaje: 'Seleccione su sucursal.',
              rol: usuario.rol,
              username: usuario.username,
              nombre: usuario.nombre,
              sucursales
            });
          }
        );
      });
    }
  );
});

// POST /auth/select-branch — paso 2: seleccionar sucursal
router.post('/select-branch', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  const { sucursal_id } = req.body;
  if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido.' });

  // Verificar que el usuario pertenece a esa sucursal
  db.get(
    `SELECT s.id, s.nombre FROM sucursales s
     JOIN sucursal_usuarios su ON su.sucursal_id = s.id
     WHERE su.usuario_id = ? AND s.id = ?`,
    [req.session.userId, sucursal_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error interno.' });
      if (!row) return res.status(403).json({ error: 'No pertenece a esa sucursal.' });

      req.session.sucursalId = row.id;
      req.session.sucursalNombre = row.nombre;
      req.session.save(() => res.json({ mensaje: 'Sucursal seleccionada.', sucursal: row.nombre }));
    }
  );
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión.' });
    const isForm = req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded');
    if (isForm || !req.headers.accept || !req.headers.accept.includes('application/json')) {
      return res.redirect('/login');
    }
    res.json({ mensaje: 'Sesión cerrada correctamente.' });
  });
});

// GET /auth/me
router.get('/me', meRateLimiter, (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  // Fetch fresh user data including tipo_area
  db.get('SELECT tipo_area FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
    res.json({
      userId: req.session.userId,
      username: req.session.username,
      rol: req.session.rol,
      nombre: req.session.nombre,
      sucursalId: req.session.sucursalId || null,
      sucursalNombre: req.session.sucursalNombre || null,
      tipo_area: (row && row.tipo_area) || null
    });
  });
});

module.exports = router;
