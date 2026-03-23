# E-TURNS — Sistema Electrónico de Gestión de Turnos

Sistema completo de gestión de turnos para hospitales y centros de salud. Desarrollado con Node.js, Express, Socket.IO y SQLite3.

---

## 📦 Tecnologías

- **Node.js + Express** — Servidor web
- **Socket.IO** — Comunicación en tiempo real
- **SQLite3** — Base de datos local
- **express-session + bcryptjs** — Autenticación con roles
- **multer** — Subida de archivos (logos)
- **Web Speech API** — Anuncio de turnos por voz (TTS) en español

---

## 🚀 Instalación y Ejecución

```bash
# Clonar el repositorio
git clone https://github.com/WinDevDr/E-TURNS.git
cd E-TURNS

# Instalar dependencias
npm install

# (Opcional) Configurar variables de entorno
cp .env.example .env
# Editar .env y establecer SESSION_SECRET

# Iniciar el servidor
npm start
```

El servidor estará disponible en `http://localhost:3000`

Al iniciar, el sistema redirige automáticamente a la página de **login** en `/login`.

---

## 🔐 Usuarios por Defecto

> Estos usuarios se crean automáticamente la primera vez que se inicia el servidor.

| Usuario | Contraseña | Rol | Acceso |
|---------|------------|-----|--------|
| `admin` | `admin123` | Administrador | Todas las páginas |
| `operador` | `op123` | Operador | Solo Panel de Operador |

> ⚠️ **Recomendación de seguridad:** Cambie las contraseñas por defecto antes de poner el sistema en producción.

---

## 🖥️ Módulos del Sistema

| Módulo | URL | Acceso | Descripción |
|--------|-----|--------|-------------|
| 🔐 **Login** | `/login` | Público | Página de inicio de sesión con selector de rol |
| 🏠 **Dashboard Admin** | `/home` | Solo Admin | Panel con acceso a todos los módulos |
| 🖥️ **Kiosco** | `/kiosco` | Público | Pantalla táctil donde el paciente selecciona el área y obtiene su turno |
| 👩‍💼 **Panel Operador** | `/panel` | Autenticado | Panel para llamar, repetir, atender y transferir turnos |
| 📺 **Pantalla Pública** | `/pantalla` | Público | Pantalla TV con turno actual, anuncio por voz y video YouTube |
| ⚙️ **Administración** | `/admin` | Solo Admin | Configurar logo, áreas (con logos), ventanillas y datos del hospital |
| 📊 **Estadísticas** | `/stats` | Solo Admin | Dashboard de turnos atendidos, tiempos de espera y más |

---

## 🔌 API REST

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/auth/login` | Iniciar sesión (body: `{ "username", "password", "rol" }`) |
| `POST` | `/auth/logout` | Cerrar sesión |
| `GET` | `/auth/me` | Obtener usuario de sesión actual |

### Turnos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/turnos` | Obtener todos los turnos |
| `POST` | `/api/turnos` | Crear nuevo turno (body: `{ "area": "Consulta" }`) |
| `PUT` | `/api/turnos/:id/llamar` | Marcar turno como llamado |
| `PUT` | `/api/turnos/:id/atender` | Marcar turno como atendido |

### Áreas *(requiere admin)*

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/areas` | Obtener áreas |
| `POST` | `/api/areas` | Crear área (body: `{ "nombre", "prefijo", "color" }`) |
| `PUT` | `/api/areas/:id/logo` | Subir logo de área (multipart, campo: `logo`) |
| `DELETE` | `/api/areas/:id` | Eliminar área |

### Ventanillas *(requiere admin)*

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/ventanillas` | Listar ventanillas |
| `POST` | `/api/ventanillas` | Crear ventanilla (body: `{ "nombre" }`) |
| `PUT` | `/api/ventanillas/:id` | Renombrar ventanilla (body: `{ "nombre" }`) |
| `PUT` | `/api/ventanillas/:id/usuario` | Asignar operador (body: `{ "usuario_id" }`) |
| `DELETE` | `/api/ventanillas/:id` | Eliminar ventanilla |

### Configuración *(requiere admin)*

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/config` | Obtener configuración del hospital |
| `PUT` | `/api/config` | Actualizar configuración (JSON) |
| `PUT` | `/api/config/logo` | Subir logo del sistema (multipart, campo: `logo`) |
| `GET` | `/api/stats` | Estadísticas del día |

---

## ⚡ Eventos Socket.IO

| Evento emitido | Evento recibido | Descripción |
|----------------|-----------------|-------------|
| `new_turn` | `turn_added` | Nuevo turno generado |
| `call_turn` | `turn_called` | Turno llamado (muestra en pantalla + TTS) |
| `repeat_turn` | `turn_called` | Repetir llamada de turno |
| `update_stats` | `stats_updated` | Actualizar estadísticas |

---

## ⚙️ Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```
PORT=3000
DB_PATH=./e-turns.db
SESSION_SECRET=cambia_esto_por_una_clave_secreta_segura
```

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `DB_PATH` | Ruta del archivo SQLite | `./e-turns.db` |
| `SESSION_SECRET` | Clave secreta para sesiones | *(valor de desarrollo, cambiar en producción)* |

---

## 📁 Estructura del Proyecto

```
E-TURNS/
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── config/
│   └── config.json
├── db/
│   └── database.js
├── middleware/
│   └── authMiddleware.js
├── routes/
│   ├── api.js
│   └── auth.js
├── sockets/
│   └── events.js
└── public/
    ├── login/
    │   └── index.html
    ├── home/
    │   └── index.html
    ├── kiosco/
    │   ├── index.html
    │   └── kiosco.js
    ├── panel/
    │   └── index.html
    ├── pantalla/
    │   └── index.html
    ├── admin/
    │   └── index.html
    ├── stats/
    │   └── index.html
    └── uploads/
        ├── logo/       ← Logo del sistema
        └── areas/      ← Logos por área
```

---

## 👤 Autor

**WinDevDr** — [GitHub](https://github.com/WinDevDr)

## 📄 Licencia

ISC
