const socket = io();
let turnoActual = null;

// Cargar configuración del hospital
async function cargarConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.nombre) document.getElementById('hospital-nombre').textContent = config.nombre;
    if (config.logo) {
      const logo = document.getElementById('hospital-logo');
      logo.src = config.logo;
      logo.style.display = 'block';
    }
  } catch (e) {
    console.error('Error al cargar config:', e);
  }
}

// Cargar áreas dinámicamente
async function cargarAreas() {
  try {
    const res = await fetch('/api/areas');
    const areas = await res.json();
    const grid = document.getElementById('areas-grid');
    grid.innerHTML = '';

    if (areas.length === 0) {
      grid.innerHTML = '<p style="color:#888;text-align:center">No hay áreas configuradas.</p>';
      return;
    }

    areas.forEach(area => {
      const btn = document.createElement('button');
      btn.className = 'area-btn';
      btn.style.background = area.color || '#0d6efd';
      btn.innerHTML = `<span class="prefijo">${area.prefijo}</span><span>${area.nombre}</span>`;
      btn.addEventListener('click', () => solicitarTurno(area.nombre));
      grid.appendChild(btn);
    });
  } catch (e) {
    document.getElementById('areas-grid').innerHTML = '<p style="color:red">Error al cargar áreas.</p>';
  }
}

// Solicitar turno
async function solicitarTurno(area) {
  try {
    const res = await fetch('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area })
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Error: ' + err.error);
      return;
    }

    const turno = await res.json();
    turnoActual = turno;

    // Mostrar modal
    document.getElementById('ticket-numero').textContent = turno.numero;
    document.getElementById('ticket-area').textContent = turno.area;
    document.getElementById('ticket-hora').textContent = new Date(turno.fecha_hora).toLocaleString('es-ES');
    document.getElementById('modal-ticket').classList.add('active');

    // Emitir evento al socket
    socket.emit('new_turn', turno);
  } catch (e) {
    alert('Error al solicitar turno. Intente nuevamente.');
  }
}

function cerrarModal() {
  document.getElementById('modal-ticket').classList.remove('active');
  turnoActual = null;
}

function imprimirTicket() {
  if (!turnoActual) return;
  const win = window.open('', '_blank', 'width=400,height=500');
  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket E-TURNS</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
        .numero { font-size: 5rem; font-weight: 900; color: #0d6efd; margin: 1rem 0; }
        h2 { color: #333; }
        p { color: #555; }
        hr { margin: 1rem 0; }
      </style>
    </head>
    <body>
      <h2>E-TURNS</h2>
      <hr>
      <div class="numero">${turnoActual.numero}</div>
      <p><strong>Área:</strong> ${turnoActual.area}</p>
      <p><strong>Hora:</strong> ${new Date(turnoActual.fecha_hora).toLocaleString('es-ES')}</p>
      <hr>
      <p>Por favor espere a ser llamado.</p>
      <script>window.onload = function() { window.print(); window.close(); };<\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// Inicializar
cargarConfig();
cargarAreas();
