const socket = io();
let turnoActual = null;
let configSistema = {};
let sucursalKiosco = null; // sucursal_id configurada para este kiosco
let autoCloseTimer = null;

// Cargar configuración del hospital
async function cargarConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    configSistema = config;

    // Nombre del hospital (solo si no hay logo)
    const logoUrl = config.logo_url || config.logo;
    if (logoUrl) {
      const logo = document.getElementById('hospital-logo');
      logo.src = logoUrl;
      logo.style.display = 'block';
      document.getElementById('hospital-nombre').style.display = 'none';
    } else if (config.nombre) {
      document.getElementById('hospital-nombre').textContent = config.nombre;
    }

    // Aplicar colores del kiosco
    const primario = config.color_kiosco_primario || config.colorPrimario || '#FF8500';
    const bg = config.color_kiosco_fondo || '#f5f5f5';
    document.body.style.background = bg;

    // Actualizar colores de botones con el color primario configurado
    document.querySelectorAll('.tipo-btn:not(.pref-btn)').forEach((btn, i) => {
      // Solo actualizar el primer botón si hay un color primario configurado diferente al default
      if (i === 0 && primario !== '#FF8500') {
        btn.style.background = primario;
      }
    });

    // Sucursal del kiosco (configurada en admin)
    if (config.kiosco_sucursal_id) {
      sucursalKiosco = config.kiosco_sucursal_id;
    }
  } catch (e) {
    console.error('Error al cargar config:', e);
  }
}

// Solicitar turno normal — todos los tipos inician en Facturación
async function solicitarTurno(tipo) {
  await _crearTurno(tipo, 'Facturación', 0);
}

// Solicitar turno preferencial — todos los tipos inician en Facturación
async function solicitarTurnoPref(tipo) {
  cerrarModalPreferencial();
  await _crearTurno(tipo, 'Facturación', 1);
}

async function _crearTurno(tipo_paciente, area, preferencial) {
  try {
    const body = { area, tipo_paciente, preferencial };
    if (sucursalKiosco) body.sucursal_id = sucursalKiosco;

    const res = await fetch('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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

    // Reiniciar barra de cuenta regresiva
    const bar = document.getElementById('countdown-bar');
    bar.style.animation = 'none';
    void bar.offsetWidth; // reflow
    bar.style.animation = 'countdown-shrink 2s linear forwards';

    // Auto-cerrar en 2 segundos
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      cerrarModal();
    }, 2000);

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
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  document.getElementById('modal-ticket').classList.remove('active');
  turnoActual = null;
}

function imprimirTicket() {
  if (!turnoActual) return;
  // Detener auto-close al imprimir (el usuario puede querer ver el ticket)
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }

  const logoUrl = configSistema.logo_url || configSistema.logo || '';
  const nombreInst = configSistema.nombre || 'E-TURNS';
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:1rem"><img src="${logoUrl}" alt="Logo" style="max-height:90px;max-width:200px;object-fit:contain"></div>`
    : `<h2 style="text-align:center;margin-bottom:1rem;color:#FF8500">${nombreInst}</h2>`;

  const prefHtml = turnoActual.preferencial
    ? `<p style="color:#f59e0b;font-weight:700;text-align:center">⭐ Turno Preferencial</p>`
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
      <title>Ticket</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
        .numero { font-size: 5rem; font-weight: 900; color: #FF8500; margin: 1rem 0; }
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

  // Auto-cerrar modal 2s después de imprimir
  autoCloseTimer = setTimeout(() => cerrarModal(), 2000);
}

// Inicializar
cargarConfig();
