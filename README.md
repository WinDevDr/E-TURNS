# E-TURNS — Sistema Electrónico de Gestión de Turnos

Sistema completo de gestión de turnos para hospitales y centros de salud. Desarrollado con Node.js, Express, Socket.IO y SQLite3.

---

## 📦 Tecnologías

- **Node.js + Express** — Servidor web
- **Socket.IO** — Comunicación en tiempo real
- **SQLite3** — Base de datos local
- **Web Speech API** — Anuncio de turnos por voz (TTS) en español

---

## 🚀 Instalación y Ejecución

```bash
# Clonar el repositorio
git clone https://github.com/WinDevDr/E-TURNS.git
cd E-TURNS

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

El servidor estará disponible en `http://localhost:3000`

---

## 🖥️ Módulos del Sistema

| Módulo | URL | Descripción |
|--------|-----|-------------|
| 🏠 **Inicio** | `/` | Página principal con acceso a todos los módulos |
| 🖥️ **Kiosco** | `/kiosco` | Pantalla táctil donde el paciente selecciona el área y obtiene su turno con ticket imprimible |
| 👩‍💼 **Panel Operador** | `/panel` | Panel para llamar, repetir, atender y transferir turnos |
| 📺 **Pantalla Pública** | `/pantalla` | Pantalla TV con turno actual, anuncio por voz y video YouTube |
| ⚙️ **Administración** | `/admin` | Configurar hospital: logo, colores, áreas, ventanillas, mensajes |
| 📊 **Estadísticas** | `/stats` | Dashboard de turnos atendidos, tiempos de espera y más |

---

## 🔌 API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/turnos` | Obtener todos los turnos |
| `POST` | `/api/turnos` | Crear nuevo turno (body: `{ "area": "Consulta" }`) |
| `PUT` | `/api/turnos/:id/llamar` | Marcar turno como llamado |
| `PUT` | `/api/turnos/:id/atender` | Marcar turno como atendido |
| `GET` | `/api/areas` | Obtener áreas |
| `POST` | `/api/areas` | Crear área (body: `{ "nombre": "...", "prefijo": "X", "color": "#..." }`) |
| `GET` | `/api/config` | Obtener configuración del hospital |
| `PUT` | `/api/config` | Actualizar configuración |
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
```

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
├── routes/
│   └── api.js
├── sockets/
│   └── events.js
└── public/
    ├── index.html
    ├── kiosco/
    │   ├── index.html
    │   └── kiosco.js
    ├── panel/
    │   └── index.html
    ├── pantalla/
    │   └── index.html
    ├── admin/
    │   └── index.html
    └── stats/
        └── index.html
```

---

## 👤 Autor

**WinDevDr** — [GitHub](https://github.com/WinDevDr)

## 📄 Licencia

ISC
