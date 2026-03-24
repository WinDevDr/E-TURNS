# E-TURNS — Sistema Electrónico de Turnos

Sistema de gestión de turnos electrónico para instituciones de salud, construido con Node.js, Express, Socket.IO y SQLite3.

## Características

- **Kiosco touchscreen** para solicitar turnos por tipo de paciente (Asegurado, No Asegurado, Entrega de Resultados, Toma de Muestra, Pre-Empleo, Turno Preferencial)
- **Panel operador Kanban** con columnas de flujo: Sala de Espera → Facturación → Espera Toma de Muestra → Toma de Muestra
- **Pantalla pública** con TTS (text-to-speech) para anuncio de turnos y video publicitario (YouTube o archivo subido)
- **Administración** completa: usuarios, ventanillas, áreas, configuración visual, horarios, colores del kiosco
- **Estadísticas** con exportación CSV y filtro por fecha
- **Tiempo real** vía Socket.IO
- **Turnos preferenciales** con indicador visual dorado

## Instalación

```bash
git clone <url-del-repositorio>
cd E-TURNS
npm install
cp .env.example .env  # Edite con sus valores
npm start
```

El servidor inicia en `http://localhost:3000` (o el `PORT` configurado).

## Credenciales por defecto

| Usuario   | Contraseña | Rol      |
|-----------|------------|----------|
| `adiaz`   | `admin123` | Admin    |
| `jperez`  | `op123`    | Operador |

> **Cambie estas credenciales antes de usar en producción.**

## Roles del sistema

| Rol       | Acceso                                                |
|-----------|-------------------------------------------------------|
| `admin`   | Administración, estadísticas, panel, kiosco, pantalla |
| `operador`| Panel de operador                                     |

## Guía de páginas

| Ruta          | Descripción                              | Acceso      |
|---------------|------------------------------------------|-------------|
| `/kiosco`     | Kiosco touchscreen para pacientes        | Público     |
| `/panel`      | Panel Kanban del operador                | Autenticado |
| `/pantalla`   | Pantalla pública de llamado de turnos    | Público     |
| `/admin`      | Administración del sistema               | Admin       |
| `/stats`      | Estadísticas y exportación CSV           | Admin       |
| `/home`       | Menú principal admin                     | Admin       |

## Flujo de trabajo

```
Kiosco → Sala de Espera → [Llamar a Facturación] → En Facturación
                                                          |
                                              [Solo Facturación] → Atendido
                                              [Pasar a Toma de Muestra]
                                                          |
                                              Espera Toma de Muestra
                                                          |
                                              [Llamar a Toma de Muestra] → En Toma de Muestra
                                                          |
                                              [Atendido] → Completado
```

### Tipos de turno especiales
- **Entrega de Resultados**: pasa por Facturación primero (como todos los demás tipos)
- **Turno Preferencial**: cualquier tipo marcado como prioritario (borde dorado en Kanban)

## Configuración

Desde `/admin` puede configurar:
- Nombre e imagen del hospital/institución
- Colores del sistema y del kiosco
- Video publicitario (URL YouTube o archivo MP4/WebM)
- Horario de atención (mostrado en pantalla pública)
- Usuarios y ventanillas
- Voz TTS para anuncios

## Variables de entorno

| Variable          | Descripción                           | Default              |
|-------------------|---------------------------------------|----------------------|
| `PORT`            | Puerto del servidor                   | `3000`               |
| `SESSION_SECRET`  | Clave secreta para sesiones           | `eturns-secret-2024` |
| `DB_PATH`         | Ruta a la base de datos SQLite        | `./e-turns.db`       |
| `NODE_ENV`        | Entorno (`production`/`development`)  | `development`        |

## Stack tecnológico

- **Backend**: Node.js + Express 4
- **Tiempo real**: Socket.IO 4
- **Base de datos**: SQLite3
- **Sesiones**: express-session
- **Archivos**: Multer (logos, videos)
- **Rate limiting**: express-rate-limit
- **Seguridad**: bcryptjs, httpOnly cookies, HTML escaping
