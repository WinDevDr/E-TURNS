const socket = io();
let turnoActual = null;
let configSistema = {};
let sucursalKiosco = null;
let autoCloseTimer = null;

const STORAGE_KEY = 'eturn_kiosco_sucursal';

// ===== BRANCH SELECTION =====
async function iniciarKiosco() {
  // Check localStorage for saved branch
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && Number.isInteger(Number(parsed.id)) && Number(parsed.id) > 0 && typeof parsed.nombre === 'string') {
        sucursalKiosco = parseInt(parsed.id, 10);
        const tag = document.getElementById('sucursal-tag');
        if (tag) tag.textContent = 'Sucursal: ' + parsed.nombre + ' (cambiar)';
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) { localStorage.removeItem(STORAGE_KEY); }
  }

  if (!sucursalKiosco) {
    // Show branch selection overlay
    await mostrarSelectorSucursal();
  } else {
    socket.emit('join_branch', { sucursal_id: sucursalKiosco });
    await cargarConfig();
    await cargarTipos();
  }
}

async function mostrarSelectorSucursal() {
  try {
    const res = await fetch('/api/sucursales/public');
    const sucursales = await res.json();
    const sel = document.getElementById('branch-select');
    sel.innerHTML = '<option value="">-- Seleccione una sucursal --</option>';

    if (sucursales.length === 1) {
      // Auto-assign if only one
      const s = sucursales[0];
      sucursalKiosco = s.id;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: s.id, nombre: s.nombre }));
      const tag = document.getElementById('sucursal-tag');
      if (tag) tag.textContent = 'Sucursal: ' + s.nombre + ' (cambiar)';
      socket.emit('join_branch', { sucursal_id: sucursalKiosco });
      await cargarConfig();
      await cargarTipos();
      return;
    }

    sucursales.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.nombre;
      sel.appendChild(opt);
    });
    sel.size = Math.min(sucursales.length + 1, 7);
    document.getElementById('branch-overlay').classList.add('active');
  } catch (e) {
    console.error('Error al cargar sucursales:', e);
    // Proceed without branch
    await cargarConfig();
    await cargarTipos();
  }
}

function confirmarSucursalKiosco() {
  const sel = document.getElementById('branch-select');
  const id = parseInt(sel.value);
  if (!id) { alert('Por favor seleccione una sucursal.'); return; }
  const nombre = sel.options[sel.selectedIndex].textContent;
  sucursalKiosco = id;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, nombre }));
  document.getElementById('branch-overlay').classList.remove('active');
  const tag = document.getElementById('sucursal-tag');
  if (tag) tag.textContent = 'Sucursal: ' + nombre + ' (cambiar)';
  socket.emit('join_branch', { sucursal_id: sucursalKiosco });
  cargarConfig();
  cargarTipos();
}

function cambiarSucursal() {
  localStorage.removeItem(STORAGE_KEY);
  sucursalKiosco = null;
  mostrarSelectorSucursal();
}

// ===== CONFIG =====
async function cargarConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    configSistema = config;

    const logoUrl = config.logo_url || config.logo;
    if (logoUrl) {
      const logo = document.getElementById('hospital-logo');
      logo.src = logoUrl;
      logo.style.display = 'block';
      document.getElementById('hospital-nombre').style.display = 'none';
    } else if (config.nombre) {
      document.getElementById('hospital-nombre').textContent = config.nombre;
    }

    const bg = config.color_kiosco_fondo || '#f5f5f5';
    document.body.style.background = bg;
  } catch (e) {
    console.error('Error al cargar config:', e);
  }
}

// ===== TIPOS =====
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
      const brightness = hexBrightness(t.color || '#FF8500');
      btn.style.color = brightness > 160 ? '#333' : '#fff';
      btn.textContent = t.nombre;
      btn.onclick = () => solicitarTurno(t.nombre);
      grid.appendChild(btn);
    });

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
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return 128;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

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

async function solicitarTurno(tipo) {
  await _crearTurno(tipo, 'Facturación', 0);
}

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

    document.getElementById('ticket-numero').textContent = turno.numero;
    document.getElementById('ticket-area').textContent = turno.area;
    document.getElementById('ticket-tipo').textContent = turno.tipo_paciente ? `Tipo: ${turno.tipo_paciente}` : '';
    document.getElementById('ticket-hora').textContent = new Date(turno.fecha_hora).toLocaleString('es-ES');

    const prefBadge = document.getElementById('ticket-pref-badge');
    prefBadge.innerHTML = turno.preferencial ? '<span class="badge-pref">Preferencial</span>' : '';

    document.getElementById('modal-ticket').classList.add('active');

    const bar = document.getElementById('countdown-bar');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = 'countdown-shrink 2s linear forwards';

    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => cerrarModal(), 2000);

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
  autoCloseTimer = setTimeout(() => cerrarModal(), 2000);
}

iniciarKiosco();
