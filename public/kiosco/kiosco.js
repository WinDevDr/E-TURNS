const socket = io();
let turnoActual = null;
let configSistema = {};
let sucursalKiosco = null; // sucursal_id configurado para este kiosco
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

    // Aplicar color de fondo del kiosco
    const bg = config.color_kiosco_fondo || '#f5f5f5';
    document.body.style.background = bg;

    // Sucursal del kiosco (configurada en admin)
    if (config.kiosco_sucursal_id) {
      sucursalKiosco = config.kiosco_sucursal_id;
      // Unirse a sala de socket por sucursal
      socket.emit('join_branch', { sucursal_id: sucursalKiosco });
    }
  } catch (e) {
    console.error('Error al cargar config:', e);
  }
}

// Cargar tipos de atención dinámicamente
async function cargarTipos() {
  try {
    const res = await fetch('/api/tipos-kiosco');
    const tipos = await res.json();
    const grid = document.getElementById('tipos-grid');
    grid.innerHTML = '';

    tipos.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tipo-btn';
      btn.style.background = t.color || '#FF8500';
      // Detectar si el color es muy claro para usar texto oscuro
      const brightness = hexBrightness(t.color || '#FF8500');
      btn.style.color = brightness > 160 ? '#333' : '#fff';
      btn.textContent = t.nombre;
      btn.onclick = () => solicitarTurno(t.nombre);
      grid.appendChild(btn);
    });

    // Botón de turno preferencial siempre al final
    const prefBtn = document.createElement('button');
    prefBtn.className = 'tipo-btn pref-btn';
    prefBtn.style.background = '#ffc107';
    prefBtn.style.color = '#333';
    prefBtn.textContent = 'Turno Preferencial';
    prefBtn.onclick = () => abrirModalPreferencial(tipos);
    grid.appendChild(prefBtn);
  } catch (e) {
    console.error('Error al cargar tipos:', e);
  }
}

function hexBrightness(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Abrir modal preferencial con tipos cargados dinámicamente
function abrirModalPreferencial(tipos) {
  const grid = document.getElementById('modal-pref-grid');
  grid.innerHTML = '';
  tipos.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tipo-btn';
    btn.style.background = t.color || '#FF8500';
    const brightness = hexBrightness(t.color || '#FF8500');
    btn.style.color = brightness > 160 ? '#333' : '#fff';
    btn.textContent = t.nombre;
    btn.onclick = () => solicitarTurnoPref(t.nombre);
    grid.appendChild(btn);
  });
  document.getElementById('modal-preferencial').classList.add('active');
}

// Solicitar turno normal
async function solicitarTurno(tipo) {
  await _crearTurno(tipo, 'Facturación', 0);
}

// Solicitar turno preferencial
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
    prefBadge.innerHTML = turno.preferencial ? '<span class="badge-pref">Preferencial</span>' : '';

    document.getElementById('modal-ticket').classList.add('active');

    // Reiniciar barra de cuenta regresiva
    const bar = document.getElementById('countdown-bar');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = 'countdown-shrink 2s linear forwards';

    // Auto-cerrar en 2 segundos
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => cerrarModal(), 2000);

    // Emitir al socket de la sucursal
    socket.emit('new_turn', turno);
  } catch (e) {
    alert('Error al solicitar turno. Intente nuevamente.');
  }
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
  if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }

  const logoUrl = configSistema.logo_url || configSistema.logo || '';
  const nombreInst = configSistema.nombre || 'E-TURNS';
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:1rem"><img src="${logoUrl}" alt="Logo" style="max-height:90px;max-width:200px;object-fit:contain"></div>`
    : `<h2 style="text-align:center;margin-bottom:1rem;color:#FF8500">${nombreInst}</h2>`;

  const prefHtml = turnoActual.preferencial
    ? `<p style="color:#f59e0b;font-weight:700;text-align:center">Turno Preferencial</p>`
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

  // Auto-cerrar modal después de imprimir
  autoCloseTimer = setTimeout(() => cerrarModal(), 2000);
}

// Inicializar
cargarConfig();
cargarTipos();
