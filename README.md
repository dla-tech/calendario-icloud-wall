# Calendario digital de pared para iMac

App web con React + Vite, Node.js + Express, FullCalendar y conexion CalDAV a Apple Calendar/iCloud. Esta pensada para dejarse abierta en pantalla completa en una iMac, con reloj grande, eventos visibles desde lejos, vistas de dia, semana y mes, barra lateral, mini calendario y actualizacion automatica cada 15 segundos.

## Requisitos

- Node.js 20 o superior
- Cuenta Apple ID con iCloud Calendar activo
- Contrasena especifica de app para iCloud

## Instalacion

```bash
npm install
```

## Configurar variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Edita `.env`:

```bash
ICLOUD_USERNAME=tu-correo@icloud.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
CALDAV_SERVER=https://caldav.icloud.com
PORT=4000
```

Las credenciales solo se usan en el servidor Express. El frontend nunca recibe la contrasena de iCloud.

## Crear una contrasena especifica de app en Apple ID

1. Entra a `https://account.apple.com`.
2. Inicia sesion con tu Apple ID.
3. Ve a la seccion de inicio de sesion y seguridad.
4. Busca contrasenas especificas de app.
5. Crea una contrasena nueva para esta app, por ejemplo `Calendario iMac`.
6. Copia esa contrasena en `ICLOUD_APP_PASSWORD`.

Apple muestra la contrasena una sola vez. Si la pierdes, crea otra.

## Correr servidor y cliente

Desde la raiz del proyecto:

```bash
npm run dev
```

Esto inicia:

- Server Express: `http://localhost:4000`
- Client Vite: `http://localhost:5173`

Abre `http://localhost:5173` en la iMac.

## Pantalla completa en la iMac

1. Abre la app en Safari, Chrome o Edge.
2. Pulsa el boton de pantalla completa en la esquina superior derecha de la app.
3. Tambien puedes usar el modo pantalla completa del navegador en macOS.
4. Deja la pestana abierta. La app consulta `/api/events` cada 15 segundos.

Si cambias eventos desde tu iPhone en Apple Calendar, iCloud los expone por CalDAV y la web los vuelve a cargar automaticamente en el siguiente ciclo de sincronizacion.

## Endpoint

```http
GET /api/events
```

Respuesta:

```json
{
  "calendars": [
    {
      "id": "https://...",
      "name": "Personal",
      "color": "#2563eb"
    }
  ],
  "events": [
    {
      "id": "evento-1",
      "title": "Cita",
      "start": "2026-06-24T14:00:00.000Z",
      "end": "2026-06-24T15:00:00.000Z",
      "allDay": false
    }
  ],
  "fetchedAt": "2026-06-24T12:00:00.000Z"
}
```

El endpoint tambien acepta `start` y `end` como query params ISO si quieres limitar el rango:

```http
GET /api/events?start=2026-06-01T00:00:00.000Z&end=2026-07-01T00:00:00.000Z
```

## Estructura

```text
client/
  src/
    App.jsx
    main.jsx
    styles.css
server/
  src/
    index.js
.env.example
package.json
README.md
```
