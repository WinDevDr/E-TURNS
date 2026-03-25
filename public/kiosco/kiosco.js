const socket = io();
let turnoActual = null;
let configSistema = {};
let sucursalKiosco = null;
let autoCloseTimer = null;

const STORAGE_KEY = 'eturn_kiosco_sucursal';

// ===== BRANCH CHECK — redirect to select page if no branch =====
async function iniciarKiosco() {
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
    // Redirect to dedicated branch selection page
    window.location.href = '/kiosco-select';
    return;
  }

  socket.emit('join_branch', { sucursal_id: sucursalKiosco });
  await cargarConfig();
  await cargarTipos();
}

function cambiarSucursal() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/kiosco-select';
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

    // Apply font family
    if (config.font_family) {
      document.body.style.fontFamily = config.font_family;
    }
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
    setTimeout(() => imprimirTicket(), 100);
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

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300..700&display=swap');
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Comfortaa', Arial, sans-serif;
          text-align: center;
          width: 80mm;
          margin: 0;
          padding: 6mm 4mm;
          color: #333;
        }
        .numero { font-size: 4.4rem; font-weight: 900; color: #FF8500; margin: 0.6rem 0; }
        p { color: #555; margin: 0.3rem 0; }
        hr { margin: 0.8rem 0; border: 0; border-top: 1px solid #ddd; }
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
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => iframe.remove(), 1000);
    }
  };
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
  autoCloseTimer = setTimeout(() => cerrarModal(), 2000);
}

iniciarKiosco();
