const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');

// POST /auth/login
router.post('/login', (req, res) => {
  const { username, password, rol } = req.body;

  if (!username || !password || !rol) {
    return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos.' });
  }

  db.get(
    'SELECT * FROM usuarios WHERE username = ? AND rol = ?',
    [username, rol],
    (err, usuario) => {
      if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
      if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas.' });

      bcrypt.compare(password, usuario.password, (err, coincide) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas.' });

        req.session.userId = usuario.id;
        req.session.username = usuario.username;
        req.session.rol = usuario.rol;
        req.session.nombre = usuario.nombre;

        res.json({
          mensaje: 'Sesión iniciada correctamente.',
          rol: usuario.rol,
          username: usuario.username,
          nombre: usuario.nombre
        });
      });
    }
  );
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión.' });
    // Si es una petición de formulario HTML, redirigir; si es API, devolver JSON
    const isForm = req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded');
    if (isForm || !req.headers.accept || !req.headers.accept.includes('application/json')) {
      return res.redirect('/login');
    }
    res.json({ mensaje: 'Sesión cerrada correctamente.' });
  });
});

// GET /auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  res.json({
    userId: req.session.userId,
    username: req.session.username,
    rol: req.session.rol,
    nombre: req.session.nombre
  });
});

module.exports = router;
