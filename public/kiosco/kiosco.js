const socket = io();
let turnoActual = null;
let configSistema = {};

// Cargar configuración del hospital
async function cargarConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    configSistema = config;
    if (config.nombre) document.getElementById('hospital-nombre').textContent = config.nombre;
    const logoUrl = config.logo_url || config.logo;
    if (logoUrl) {
      const logo = document.getElementById('hospital-logo');
      logo.src = logoUrl;
      logo.style.display = 'block';
    }
    // Aplicar colores del kiosco al header
    const primario = config.color_kiosco_primario || config.colorPrimario || '#0d6efd';
    const secundario = config.color_kiosco_secundario || config.colorSecundario || '#198754';
    const header = document.getElementById('kiosco-header');
    if (header) header.style.background = `linear-gradient(90deg, ${primario}, ${secundario})`;
  } catch (e) {
    console.error('Error al cargar config:', e);
  }
}

// Solicitar turno normal
async function solicitarTurno(tipo) {
  const area = tipo === 'Entrega de Resultados' ? 'Toma de Muestra' : 'Facturación';
  await _crearTurno(tipo, area, 0);
}

// Solicitar turno preferencial
async function solicitarTurnoPref(tipo) {
  cerrarModalPreferencial();
  const area = tipo === 'Entrega de Resultados' ? 'Toma de Muestra' : 'Facturación';
  await _crearTurno(tipo, area, 1);
}

async function _crearTurno(tipo_paciente, area, preferencial) {
  try {
    const res = await fetch('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, tipo_paciente, preferencial })
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Error: ' + err.error);
      return;
    }

    const turno = await res.json();
    turnoActual = turno;

    // Mostrar modal de ticket
    document.getElementById('ticket-numero').textContent = turno.numero;
    document.getElementById('ticket-area').textContent = turno.area;
    document.getElementById('ticket-tipo').textContent = turno.tipo_paciente ? `Tipo: ${turno.tipo_paciente}` : '';
    document.getElementById('ticket-hora').textContent = new Date(turno.fecha_hora).toLocaleString('es-ES');

    const prefBadge = document.getElementById('ticket-pref-badge');
    prefBadge.innerHTML = turno.preferencial ? '<span class="badge-pref">⭐ Preferencial</span>' : '';

    document.getElementById('modal-ticket').classList.add('active');

    socket.emit('new_turn', turno);
  } catch (e) {
    alert('Error al solicitar turno. Intente nuevamente.');
  }
}

function abrirModalPreferencial() {
  document.getElementById('modal-preferencial').classList.add('active');
}

function cerrarModalPreferencial() {
  document.getElementById('modal-preferencial').classList.remove('active');
}

function cerrarModal() {
  document.getElementById('modal-ticket').classList.remove('active');
  turnoActual = null;
}

function imprimirTicket() {
  if (!turnoActual) return;
  const logoUrl = configSistema.logo_url || configSistema.logo || '';
  const nombreInst = configSistema.nombre || 'E-TURNS';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height:80px;max-width:180px;object-fit:contain;margin-bottom:0.5rem">`
    : `<h2 style="margin-bottom:0.5rem">${nombreInst}</h2>`;

  const prefHtml = turnoActual.preferencial
    ? `<p style="color:#f59e0b;font-weight:700">⭐ Turno Preferencial</p>`
    : '';

  const tipoHtml = turnoActual.tipo_paciente
    ? `<p><strong>Tipo:</strong> ${turnoActual.tipo_paciente}</p>`
    : '';

  const win = window.open('', '_blank', 'width=400,height=580');
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
      ${logoHtml}
      <hr>
      ${prefHtml}
      <div class="numero">${turnoActual.numero}</div>
      <p><strong>Área:</strong> ${turnoActual.area}</p>
      ${tipoHtml}
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
