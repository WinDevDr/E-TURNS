module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('new_turn', (turno) => {
      io.emit('turn_added', turno);
    });

    socket.on('call_turn', (turno) => {
      io.emit('turn_called', turno);
    });

    socket.on('repeat_turn', (turno) => {
      io.emit('turn_called', turno);
    });

    socket.on('cancel_turn', (data) => {
      io.emit('turn_cancelled', data);
    });

    socket.on('transfer_turn', (turno) => {
      io.emit('turn_transferred', turno);
    });

    socket.on('update_stats', () => {
      io.emit('stats_updated');
    });

    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });
};
