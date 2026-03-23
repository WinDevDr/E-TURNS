try { require('dotenv').config(); } catch (e) { /* dotenv opcional */ }
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Rutas de vistas
app.get('/kiosco', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosco', 'index.html')));
app.get('/panel', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'panel', 'index.html')));
app.get('/pantalla', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'pantalla', 'index.html')));
app.get('/admin', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('/stats', viewLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'stats', 'index.html')));

// Rutas API
const apiRouter = require('./routes/api');
app.use('/api', apiLimiter, apiRouter);

// Socket.IO
const setupSockets = require('./sockets/events');
setupSockets(io);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`E-TURNS corriendo en http://localhost:${PORT}`);
});
