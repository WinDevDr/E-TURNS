module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Unirse a la sala de una sucursal específica
    socket.on('join_branch', (data) => {
      if (data && data.sucursal_id && Number.isInteger(Number(data.sucursal_id)) && Number(data.sucursal_id) > 0) {
        const room = `branch_${parseInt(data.sucursal_id, 10)}`;
        socket.join(room);
        console.log(`Socket ${socket.id} se unió a sala ${room}`);
      }
    });

    // Nuevo turno — emitir a la sala de la sucursal si tiene una, sino a todos
    socket.on('new_turn', (turno) => {
      if (turno && turno.sucursal_id) {
        io.to(`branch_${turno.sucursal_id}`).emit('turn_added', turno);
      } else {
        io.emit('turn_added', turno);
      }
    });

    // Turno llamado — emitir a la sala de la sucursal si tiene una, sino a todos
    socket.on('call_turn', (turno) => {
      if (turno && turno.sucursal_id) {
        io.to(`branch_${turno.sucursal_id}`).emit('turn_called', turno);
      } else {
        io.emit('turn_called', turno);
      }
    });

    socket.on('repeat_turn', (turno) => {
      if (turno && turno.sucursal_id) {
        io.to(`branch_${turno.sucursal_id}`).emit('turn_called', turno);
      } else {
        io.emit('turn_called', turno);
      }
    });

    socket.on('cancel_turn', (data) => {
      if (data && data.sucursal_id) {
        io.to(`branch_${data.sucursal_id}`).emit('turn_cancelled', data);
      } else {
        io.emit('turn_cancelled', data);
      }
    });

    socket.on('transfer_turn', (turno) => {
      if (turno && turno.sucursal_id) {
        io.to(`branch_${turno.sucursal_id}`).emit('turn_transferred', turno);
      } else {
        io.emit('turn_transferred', turno);
      }
    });

    socket.on('update_stats', (data) => {
      if (data && data.sucursal_id) {
        io.to(`branch_${data.sucursal_id}`).emit('stats_updated');
      } else {
        io.emit('stats_updated');
      }
    });

    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });
};
