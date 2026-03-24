# 🎫 E-TURNS - Sistema de Gestión de Turnos

Sistema completo de gestión de turnos con Kiosco, Panel de Operador (Kanban), Pantalla de Visualización, Estadísticas y Configuración personalizable.

## 📋 Características

### 🖥️ Kiosco de Turnos
- Interfaz táctil para que los pacientes tomen su turno
- Tipos de turno disponibles:
  - **Asegurado** - Pacientes con seguro
  - **No Asegurado** - Pacientes sin seguro
  - **Entrega de Resultados** - Recoger resultados
  - **Toma de Muestra** - Toma de muestras directa
  - **Pre-Empleo** - Exámenes pre-empleo
  - **Turno Preferencial** - Abre un sub-menú para seleccionar el tipo de servicio con prioridad
- Generación automática de códigos de turno con prefijos únicos
- Colores totalmente personalizables desde configuración

### 🏢 Panel de Operador (Kanban)
- Tablero Kanban con flujo de atención visual:
  1. **Espera en Sala** - Turnos esperando ser llamados
  2. **Facturación** - Turno siendo atendido en facturación
  3. **Sala de Espera - Toma de Muestra** - Esperando pasar a toma de muestra
  4. **Toma de Muestra** - Turno siendo atendido en toma de muestra
  5. **Completados** - Turnos finalizados
- Acciones disponibles por turno:
  - 📞 Llamar turno a un área específica
  - → Transferir turno al siguiente área
  - ✓ Completar turno
  - ✕ Cancelar turno
- Selección de operador al inicio de sesión
- Registro automático de quién atendió cada turno
- Actualización en tiempo real vía Socket.IO

### 📺 Pantalla de Visualización
- Muestra los turnos actuales siendo llamados con animación
- Lista de turnos en espera
- Sonido de notificación al llamar un turno (tono generado por Web Audio API)
- Reloj en tiempo real
- Soporte para video publicitario (subir archivo MP4, WebM, OGG, MOV)
- Soporte para YouTube (pegar URL del video)
- Horario de la sucursal personalizable
- Mensaje en marquesina personalizable
- Colores completamente personalizables (fondo, texto, resaltado, encabezado)

### 📊 Estadísticas
- Filtro por rango de fechas
- Tabla detallada con:
  - Código de turno
  - Tipo de turno
  - Si es preferencial
  - Hora de llegada
  - Hora que se llamó en Facturación
  - Quién atendió en Facturación
  - Hora que se llamó en Toma de Muestra
  - Quién atendió en Toma de Muestra
  - Hora de completado
  - Estado final
- **Exportación a Excel** (.xlsx) con formato profesional y colores

### ⚙️ Configuración
- **Colores del Kiosco**: fondo, texto, botones, texto de botones
- **Colores de Pantalla**: fondo, texto, resaltado, encabezado
- **Contenido de Pantalla**: nombre de sucursal, horario, mensajes
- **Video/YouTube**: subir video local o pegar URL de YouTube
- Los cambios se aplican en tiempo real a todas las pantallas conectadas

## 🚀 Requisitos

- **Node.js** v18 o superior
- **npm** v9 o superior

## 📦 Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/WinDevDr/E-TURNS.git
cd E-TURNS
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar el servidor:
```bash
npm start
```

4. Abrir en el navegador:
```
http://localhost:3000
```

## 🌐 URLs del Sistema

| Módulo | URL | Descripción |
|--------|-----|-------------|
| Inicio | `http://localhost:3000` | Página principal con acceso a todos los módulos |
| Kiosco | `http://localhost:3000/kiosk/` | Interfaz para que pacientes tomen turno |
| Panel | `http://localhost:3000/panel/` | Kanban de operador para gestionar turnos |
| Pantalla | `http://localhost:3000/display/` | Pantalla de visualización para sala de espera |
| Estadísticas | `http://localhost:3000/stats/` | Reportes y exportación a Excel |
| Configuración | `http://localhost:3000/config/` | Personalización de colores, videos y mensajes |

## 🏗️ Arquitectura

```
E-TURNS/
├── server/
│   ├── index.js          # Servidor Express + Socket.IO
│   ├── database.js       # SQLite database con todas las consultas
│   └── routes.js         # API REST endpoints
├── public/
│   ├── index.html        # Página de inicio
│   ├── css/
│   │   └── styles.css    # Estilos globales
│   ├── kiosk/
│   │   └── index.html    # Interfaz del kiosco
│   ├── panel/
│   │   └── index.html    # Panel de operador (Kanban)
│   ├── display/
│   │   └── index.html    # Pantalla de visualización
│   ├── stats/
│   │   └── index.html    # Estadísticas y reportes
│   ├── config/
│   │   └── index.html    # Configuración
│   └── uploads/          # Videos subidos
├── package.json
└── README.md
```

## 🔧 Tecnologías

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Base de datos**: SQLite (better-sqlite3)
- **Excel**: ExcelJS
- **Upload**: Multer
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)

## 📡 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/turn-types` | Obtener tipos de turno |
| GET | `/api/areas` | Obtener áreas de atención |
| GET | `/api/operators` | Obtener operadores |
| GET | `/api/config` | Obtener configuración |
| POST | `/api/config` | Guardar configuración |
| POST | `/api/config/upload-video` | Subir video publicitario |
| POST | `/api/turns` | Crear nuevo turno |
| GET | `/api/kanban` | Obtener datos del Kanban |
| POST | `/api/turns/:id/call` | Llamar turno a un área |
| POST | `/api/turns/:id/transfer` | Transferir turno a otra área |
| POST | `/api/turns/:id/complete` | Completar turno |
| POST | `/api/turns/:id/cancel` | Cancelar turno |
| GET | `/api/display` | Obtener datos de pantalla |
| GET | `/api/stats` | Obtener estadísticas |
| GET | `/api/stats/excel` | Exportar estadísticas a Excel |

## 📐 Flujo de Atención

```
Paciente toma turno en Kiosco
         │
         ▼
  ┌─────────────────┐
  │ Espera en Sala   │  ← Turno creado, esperando llamado
  └────────┬────────┘
           │ Operador llama turno
           ▼
  ┌─────────────────┐
  │  Facturación     │  ← Atendido por operador de facturación
  └────────┬────────┘
           │ Operador transfiere
           ▼
  ┌─────────────────────────┐
  │ Sala Espera Toma Muestra │  ← Esperando ser llamado
  └────────┬────────────────┘
           │ Operador llama turno
           ▼
  ┌─────────────────┐
  │ Toma de Muestra  │  ← Atendido por operador de toma de muestra
  └────────┬────────┘
           │ Operador completa
           ▼
  ┌─────────────────┐
  │   Completado     │  ← Turno finalizado
  └─────────────────┘
```

## ⚡ Eventos Socket.IO

| Evento | Descripción |
|--------|-------------|
| `turn-created` | Nuevo turno creado |
| `turn-called` | Turno llamado a un área |
| `turn-transferred` | Turno transferido a otra área |
| `turn-completed` | Turno completado |
| `turn-cancelled` | Turno cancelado |
| `kanban-update` | Actualización del tablero Kanban |
| `display-update` | Actualización de la pantalla |
| `config-updated` | Configuración actualizada |

## 📝 Áreas por Defecto

1. **Facturación** - Primera área de atención
2. **Toma de Muestra** - Segunda área de atención

## 👥 Operadores por Defecto

1. **Operador Facturación** (usuario: `facturacion1`) - Área: Facturación
2. **Operador Toma de Muestra** (usuario: `tomamuestra1`) - Área: Toma de Muestra

## 📄 Licencia

MIT
