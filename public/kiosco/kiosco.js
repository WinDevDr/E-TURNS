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

    // Emitir evento al socket
    socket.emit('new_turn', turno);

    // Imprimir automáticamente al recibir el turno
    imprimirTicket();

    // Mostrar modal después de imprimir
    document.getElementById('ticket-numero').textContent = turno.numero;
    document.getElementById('ticket-area').textContent = turno.area;
    document.getElementById('ticket-hora').textContent = new Date(turno.fecha_hora).toLocaleString('es-ES');
    document.getElementById('modal-ticket').classList.add('active');
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

  // Crear iframe oculto para impresión silenciosa a la impresora predeterminada (80mm Thermal Printer)
  let iframe = document.getElementById('print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-frame';
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-family: 'Arial', sans-serif;
          text-align: center;
          width: 72mm;
          margin: 0 auto;
          padding: 4mm 0;
        }
        h2 { font-size: 14pt; margin: 0 0 2mm 0; }
        .numero { font-size: 36pt; font-weight: 900; margin: 3mm 0; }
        p { font-size: 10pt; margin: 1mm 0; }
        hr { border: none; border-top: 1px dashed #000; margin: 3mm 0; }
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
    </body>
    </html>
  `);
  doc.close();

  // Esperar a que el contenido se renderice y luego imprimir
  iframe.contentWindow.onload = function() {
    iframe.contentWindow.print();
  };
  // Fallback: imprimir después de breve delay
  setTimeout(function() {
    try { iframe.contentWindow.print(); } catch(e) {}
  }, 500);
}

// Inicializar
cargarConfig();
cargarAreas();
