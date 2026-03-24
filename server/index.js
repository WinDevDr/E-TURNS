const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Initialize database
db.initialize();

// Routes
app.use('/api', routes(db, io));

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible
app.set('io', io);

server.listen(PORT, () => {
  console.log(`E-TURNS running on http://localhost:${PORT}`);
  console.log(`  Kiosk:    http://localhost:${PORT}/kiosk/`);
  console.log(`  Panel:    http://localhost:${PORT}/panel/`);
  console.log(`  Display:  http://localhost:${PORT}/display/`);
  console.log(`  Stats:    http://localhost:${PORT}/stats/`);
  console.log(`  Config:   http://localhost:${PORT}/config/`);
});
