try { require('dotenv').config(); } catch (e) { /* dotenv opcional */ }
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const { requireAuth, requireAdmin } = require('./middleware/authMiddleware');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones
if (!process.env.SESSION_SECRET) {
  console.warn('[ADVERTENCIA] SESSION_SECRET no está definido. Use una clave secreta segura en producción.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'eturns-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 horas
  }
}));

// Rate limiting para la API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente más tarde.' }
});

// Rate limiting para las rutas de vistas (acceso a archivos)
const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

// Rutas de autenticación
const authRouter = require('./routes/auth');

// Rate limiting estricto para login (protección contra fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente en 15 minutos.' }
});

app.use('/auth/login', loginLimiter);
app.use('/auth/select-branch', loginLimiter); // also rate-limit branch selection
app.use('/auth/me', apiLimiter); // rate-limit /auth/me since it queries DB
app.use('/auth', authRouter);

// Rutas de vistas — se definen ANTES de express.static para que tengan prioridad
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(req.session.rol === 'admin' ? '/home' : '/panel');
  }
  return res.redirect('/login');
});

app.get('/login', viewLimiter, (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(req.session.rol === 'admin' ? '/home' : '/panel');
  }
  res.sendFile(path.join(__dirname, 'public', 'login', 'index.html'));
});

app.get('/home', viewLimiter, requireAuth, requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'home', 'index.html'))
);

app.get('/kiosco', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosco', 'index.html')));
app.get('/kiosco-select', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosco-select', 'index.html')));
app.get('/kiosco/preferencial', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosco', 'index.html')));
app.get('/panel', viewLimiter, requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'panel', 'index.html')));
app.get('/pantalla', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'pantalla', 'index.html')));
app.get('/admin', viewLimiter, requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('/stats', viewLimiter, requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'stats', 'index.html')));

// Rutas API
const apiRouter = require('./routes/api');
app.use('/api', apiLimiter, apiRouter);

// Archivos estáticos (CSS, JS, imágenes, uploads) — después de las rutas de vistas
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO
const setupSockets = require('./sockets/events');
setupSockets(io);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`E-TURNS corriendo en http://localhost:${PORT}`);
});
