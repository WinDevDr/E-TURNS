/* =============================================
   E-TURNS — Gestión de Usuarios JS
   ============================================= */

const API = 'http://localhost:5000/api/admin';

// ── State ──────────────────────────────────────
let usuarios = [];
let ventanillas = [];
let activeUserId = null;
let sortCol = 'nombre';
let sortAsc = true;

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadVentanillas();
    loadUsuarios();
    setupModals();
    setupFilters();
    setupSort();
    setupSidebarToggle();
});

// ── API helpers ────────────────────────────────
async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    return json;
}

// ── Load data ──────────────────────────────────
async function loadUsuarios() {
    try {
        const data = await apiFetch('/usuarios');
        usuarios = data;
        renderStats();
        renderTable();
    } catch (e) {
        document.getElementById('usuariosBody').innerHTML =
            `<tr><td colspan="5" class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>No se pudo cargar la lista de usuarios.<br>
                   Asegúrese de que el servidor esté iniciado (<code>python app.py</code>).</p>
             </td></tr>`;
    }
}

async function loadVentanillas() {
    try {
        ventanillas = await apiFetch('/ventanillas');
        populateVentanillaSelects();
    } catch (_) { /* silently fail */ }
}

function populateVentanillaSelects() {
    const opts = ventanillas.map(v =>
        `<option value="${v.id}">${v.nombre}${v.descripcion ? ' — ' + v.descripcion : ''}</option>`
    ).join('');
    const emptyOpt = '<option value="">— Sin asignar —</option>';

    ['selectVentanilla', 'nuevoVentanilla'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = emptyOpt + opts;
    });
}

// ── Stats ──────────────────────────────────────
function renderStats() {
    document.getElementById('statTotal').textContent = usuarios.length;
    document.getElementById('statActivos').textContent = usuarios.filter(u => u.activo).length;
    document.getElementById('statInactivos').textContent = usuarios.filter(u => !u.activo).length;
    document.getElementById('statAdmins').textContent = usuarios.filter(u => u.rol === 'admin').length;
}

// ── Table rendering ────────────────────────────
function getFiltered() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const rol = document.getElementById('filterRol').value;
    const estado = document.getElementById('filterEstado').value;

    return usuarios.filter(u => {
        const matchQ = !q ||
            u.nombre.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q);
        const matchRol = !rol || u.rol === rol;
        const matchEstado = estado === '' || String(u.activo ? 1 : 0) === estado;
        return matchQ && matchRol && matchEstado;
    });
}

function getSorted(list) {
    return [...list].sort((a, b) => {
        let va = a[sortCol] ?? '';
        let vb = b[sortCol] ?? '';
        if (typeof va === 'boolean') va = va ? 1 : 0;
        if (typeof vb === 'boolean') vb = vb ? 1 : 0;
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
    });
}

function renderTable() {
    const list = getSorted(getFiltered());
    const tbody = document.getElementById('usuariosBody');

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5">
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>No se encontraron usuarios con los filtros aplicados.</p>
            </div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(u => {
        const rolBadge = `<span class="badge badge-${u.rol}">${u.rol}</span>`;
        const estadoBadge = u.activo
            ? `<span class="badge badge-activo">✅ Activo</span>`
            : `<span class="badge badge-inactivo">❌ Inactivo</span>`;
        const ventanillaTxt = u.ventanilla_nombre || '<span style="color:var(--gray-400)">—</span>';
        const toggleTitle = u.activo ? 'Desactivar usuario' : 'Activar usuario';
        const toggleIcon = u.activo ? '🚫' : '✅';
        const toggleClass = u.activo ? 'btn-danger' : 'btn-success-action';

        return `<tr data-id="${u.id}">
            <td class="td-nombre">
                <strong>${escHtml(u.nombre)}</strong>
                <span>${escHtml(u.email)}</span>
            </td>
            <td>${rolBadge}</td>
            <td>${ventanillaTxt}</td>
            <td>${estadoBadge}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action" title="Editar nombre"
                        onclick="openModalNombre(${u.id})">✏️</button>
                    <button class="btn-action" title="Cambiar contraseña"
                        onclick="openModalPassword(${u.id})">🔑</button>
                    <button class="btn-action" title="Asignar ventanilla"
                        onclick="openModalVentanilla(${u.id})">🏪</button>
                    <button class="btn-action" title="Cambiar rol"
                        onclick="openModalRol(${u.id})">👤</button>
                    <button class="btn-action ${toggleClass}" title="${toggleTitle}"
                        onclick="openConfirmEstado(${u.id}, ${!u.activo})">${toggleIcon}</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Filters ────────────────────────────────────
function setupFilters() {
    document.getElementById('searchInput').addEventListener('input', renderTable);
    document.getElementById('filterRol').addEventListener('change', renderTable);
    document.getElementById('filterEstado').addEventListener('change', renderTable);
}

// ── Sort ───────────────────────────────────────
function setupSort() {
    document.querySelectorAll('thead th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortCol === col) sortAsc = !sortAsc;
            else { sortCol = col; sortAsc = true; }

            document.querySelectorAll('thead th').forEach(t => t.classList.remove('sorted'));
            th.classList.add('sorted');
            th.querySelector('.sort-icon').textContent = sortAsc ? '↑' : '↓';
            renderTable();
        });
    });
}

// ── Sidebar toggle (mobile) ────────────────────
function setupSidebarToggle() {
    const btn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) btn.style.display = 'flex';
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
}

// ── Modal helpers ──────────────────────────────
function setupModals() {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    // Click outside modal to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
    // Nuevo usuario
    document.getElementById('btnNuevoUsuario').addEventListener('click', () => openModal('modalNuevoUsuario'));
    document.getElementById('btnGuardarNuevo').addEventListener('click', guardarNuevoUsuario);
    // Nombre
    document.getElementById('btnGuardarNombre').addEventListener('click', guardarNombre);
    // Password
    document.getElementById('btnGuardarPassword').addEventListener('click', guardarPassword);
    // Ventanilla
    document.getElementById('btnGuardarVentanilla').addEventListener('click', guardarVentanilla);
    // Rol
    document.getElementById('btnGuardarRol').addEventListener('click', guardarRol);
}

function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function clearErrors(...ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
}

function setAlert(containerId, msg, type = 'success') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
}

// ── Toast ──────────────────────────────────────
function showToast(msg, type = 'success') {
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || '💬'}</span> ${escHtml(msg)}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

// ── Nuevo Usuario ──────────────────────────────
async function guardarNuevoUsuario() {
    clearErrors('errNuevoNombre','errNuevoEmail','errNuevoPassword','errNuevoPasswordConfirm');
    const nombre = document.getElementById('nuevoNombre').value.trim();
    const email = document.getElementById('nuevoEmail').value.trim();
    const password = document.getElementById('nuevoPassword').value;
    const confirm = document.getElementById('nuevoPasswordConfirm').value;
    const rol = document.getElementById('nuevoRol').value;
    const ventanilla_id = document.getElementById('nuevoVentanilla').value || null;

    let valid = true;
    if (!nombre) { document.getElementById('errNuevoNombre').textContent = 'El nombre es requerido'; valid = false; }
    if (!email) { document.getElementById('errNuevoEmail').textContent = 'El email es requerido'; valid = false; }
    if (!password || password.length < 6) { document.getElementById('errNuevoPassword').textContent = 'Mínimo 6 caracteres'; valid = false; }
    if (password !== confirm) { document.getElementById('errNuevoPasswordConfirm').textContent = 'Las contraseñas no coinciden'; valid = false; }
    if (!valid) return;

    const btn = document.getElementById('btnGuardarNuevo');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        await apiFetch('/usuarios', {
            method: 'POST',
            body: JSON.stringify({ nombre, email, password, rol, ventanilla_id: ventanilla_id ? parseInt(ventanilla_id) : null })
        });
        closeModal('modalNuevoUsuario');
        // Reset form
        ['nuevoNombre','nuevoEmail','nuevoPassword','nuevoPasswordConfirm'].forEach(id => {
            document.getElementById(id).value = '';
        });
        showToast('Usuario creado correctamente');
        await loadUsuarios();
    } catch (e) {
        setAlert('alertNuevoUsuario', e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear usuario';
    }
}

// ── Editar Nombre ──────────────────────────────
function openModalNombre(userId) {
    activeUserId = userId;
    const u = usuarios.find(x => x.id === userId);
    if (u) document.getElementById('editNombre').value = u.nombre;
    clearErrors('errEditNombre');
    document.getElementById('alertNombre').innerHTML = '';
    openModal('modalNombre');
}

async function guardarNombre() {
    clearErrors('errEditNombre');
    const nombre = document.getElementById('editNombre').value.trim();
    if (!nombre) { document.getElementById('errEditNombre').textContent = 'El nombre es requerido'; return; }

    const btn = document.getElementById('btnGuardarNombre');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
        await apiFetch(`/usuarios/${activeUserId}/nombre`, {
            method: 'PUT',
            body: JSON.stringify({ nombre })
        });
        closeModal('modalNombre');
        showToast('Nombre actualizado correctamente');
        await loadUsuarios();
    } catch (e) {
        setAlert('alertNombre', e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
    }
}

// ── Cambiar Contraseña ─────────────────────────
function openModalPassword(userId) {
    activeUserId = userId;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    clearErrors('errNewPassword','errConfirmPassword');
    document.getElementById('alertPassword').innerHTML = '';
    openModal('modalPassword');
}

async function guardarPassword() {
    clearErrors('errNewPassword','errConfirmPassword');
    const password = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    let valid = true;
    if (!password || password.length < 6) {
        document.getElementById('errNewPassword').textContent = 'Mínimo 6 caracteres'; valid = false;
    }
    if (password !== confirm) {
        document.getElementById('errConfirmPassword').textContent = 'Las contraseñas no coinciden'; valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('btnGuardarPassword');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
        await apiFetch(`/usuarios/${activeUserId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password, confirm_password: confirm })
        });
        closeModal('modalPassword');
        showToast('Contraseña actualizada correctamente');
    } catch (e) {
        setAlert('alertPassword', e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
    }
}

// ── Asignar Ventanilla ─────────────────────────
function openModalVentanilla(userId) {
    activeUserId = userId;
    const u = usuarios.find(x => x.id === userId);
    const sel = document.getElementById('selectVentanilla');
    if (u && sel) sel.value = u.ventanilla_id || '';
    document.getElementById('alertVentanilla').innerHTML = '';
    openModal('modalVentanilla');
}

async function guardarVentanilla() {
    const ventanilla_id = document.getElementById('selectVentanilla').value;

    const btn = document.getElementById('btnGuardarVentanilla');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
        await apiFetch(`/usuarios/${activeUserId}/ventanilla`, {
            method: 'PUT',
            body: JSON.stringify({ ventanilla_id: ventanilla_id ? parseInt(ventanilla_id) : null })
        });
        closeModal('modalVentanilla');
        showToast('Ventanilla asignada correctamente');
        await loadUsuarios();
    } catch (e) {
        setAlert('alertVentanilla', e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
    }
}

// ── Cambiar Rol ────────────────────────────────
function openModalRol(userId) {
    activeUserId = userId;
    const u = usuarios.find(x => x.id === userId);
    const sel = document.getElementById('selectRol');
    if (u && sel) sel.value = u.rol;
    document.getElementById('alertRol').innerHTML = '';
    openModal('modalRol');
}

async function guardarRol() {
    const rol = document.getElementById('selectRol').value;

    const btn = document.getElementById('btnGuardarRol');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
        await apiFetch(`/usuarios/${activeUserId}/rol`, {
            method: 'PUT',
            body: JSON.stringify({ rol })
        });
        closeModal('modalRol');
        showToast('Rol actualizado correctamente');
        await loadUsuarios();
    } catch (e) {
        setAlert('alertRol', e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
    }
}

// ── Activar / Desactivar ───────────────────────
function openConfirmEstado(userId, nuevoEstado) {
    activeUserId = userId;
    const u = usuarios.find(x => x.id === userId);
    const nombre = u ? u.nombre : 'este usuario';
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const titulo = nuevoEstado ? 'Activar usuario' : 'Desactivar usuario';
    const icon = nuevoEstado ? '✅' : '⚠️';

    document.getElementById('confirmEstadoIcon').textContent = icon;
    document.getElementById('confirmEstadoTitle').textContent = titulo;
    document.getElementById('confirmEstadoMsg').textContent =
        `¿Está seguro que desea ${accion} al usuario "${nombre}"?`;

    const btn = document.getElementById('btnConfirmEstado');
    btn.className = `btn ${nuevoEstado ? 'btn-success' : 'btn-danger'}`;
    btn.textContent = nuevoEstado ? 'Activar' : 'Desactivar';
    btn.onclick = () => cambiarEstado(userId, nuevoEstado);

    openModal('modalConfirmEstado');
}

async function cambiarEstado(userId, activo) {
    const btn = document.getElementById('btnConfirmEstado');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
        await apiFetch(`/usuarios/${userId}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ activo })
        });
        closeModal('modalConfirmEstado');
        const estado = activo ? 'activado' : 'desactivado';
        showToast(`Usuario ${estado} correctamente`, activo ? 'success' : 'warning');
        await loadUsuarios();
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}
