# Calendario digital de pared para iMac

App web con React + Vite, Node.js + Express, FullCalendar y conexion CalDAV a Apple Calendar/iCloud. Esta pensada para dejarse abierta en pantalla completa en una iMac, con reloj grande, eventos visibles desde lejos, vistas de dia, semana y mes, barra lateral, mini calendario y actualizacion automatica cada 10 segundos.

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
VITE_USE_DEMO_EVENTS=false

# Opcional: acciones de Casa por webhook
HOME_ACTIONS_ENABLED=false
HOME_ACTION_WEBHOOK_URL=http://homeassistant.local:8123/api/webhook/calendario-casa
HOME_ACTION_WEBHOOK_TOKEN=
HOME_ACTION_CALENDAR=
HOME_ACTION_KEYWORD=casa
HOME_ACTION_DEFAULT_ACTION=event-started
HOME_ACTION_POLL_SECONDS=30
HOME_ACTION_TRIGGER_WINDOW_SECONDS=90
HOME_ACTION_LOOKAHEAD_MINUTES=15
```

Las credenciales solo se usan en el servidor Express. El frontend nunca recibe la contrasena de iCloud.

`VITE_USE_DEMO_EVENTS=false` mantiene la app usando solo eventos reales. Cambialo a `true` solo si quieres abrir la app en modo demo o mostrar datos demo cuando el backend no este disponible y todavia no haya datos reales cargados.

## Acciones de Casa cuando empieza un evento

Si quieres que el calendario dispare una automatizacion al llegar la hora de un evento, activa el webhook en `.env`:

```bash
HOME_ACTIONS_ENABLED=true
HOME_ACTION_WEBHOOK_URL=http://homeassistant.local:8123/api/webhook/calendario-casa
```

Luego crea eventos con `Casa:` en el titulo, por ejemplo:

```text
Casa: encender luces sala
Casa: apagar aire
[casa: modo noche]
```

Cuando llegue la hora de inicio, el servidor envia un `POST` al webhook con este formato:

```json
{
  "source": "calendario-icloud-wall",
  "action": "encender luces sala",
  "triggeredAt": "2026-07-04T18:00:00.000Z",
  "event": {
    "title": "Casa: encender luces sala",
    "start": "2026-07-04T18:00:00.000Z",
    "calendarName": "Casa"
  }
}
```

Tambien puedes hacer que todos los eventos de un calendario disparen acciones:

```bash
HOME_ACTION_CALENDAR=Casa
```

Si `HOME_ACTION_CALENDAR` esta vacio, se disparan los eventos que tengan la palabra configurada en `HOME_ACTION_KEYWORD` o una accion `Casa:` en el titulo. El endpoint `GET /api/home-actions/status` te dice si el scheduler esta activo, cuando corrio por ultima vez y si hubo algun error.

Nota importante: esto funciona en un servidor Node persistente, por ejemplo la iMac, una Mac mini o una Raspberry Pi corriendo `npm run start` o `npm run dev`. En Vercel, el handler es serverless y no puede mantener un reloj interno revisando eventos cada 30 segundos.

## Despliegue en Vercel

Selecciona la raiz del repositorio como Root Directory en Vercel. No selecciones `client`.

Configuracion esperada en Vercel:

- Root Directory: `./`
- Build Command: `npm run build`
- Output Directory: `client/dist`
- Install Command: `npm install`

El archivo `vercel.json` de la raiz ya define esos valores, publica el build de Vite desde `client/dist` y redirige `/api/*` al handler serverless de Express.

Agrega estas Environment Variables en Vercel:

```bash
ICLOUD_USERNAME=tu-correo@icloud.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
CALDAV_SERVER=https://caldav.icloud.com
```

El frontend llama siempre a `/api/events` desde el mismo dominio del despliegue. No necesitas configurar URLs publicas, dominios separados ni variables `VITE_*` para la API.

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

- Server Express: `http://127.0.0.1:4000`
- Client Vite: `http://127.0.0.1:5173`

Abre `http://127.0.0.1:5173` en la iMac.

## Pantalla completa en la iMac

1. Abre la app en Safari, Chrome o Edge.
2. Pulsa el boton de pantalla completa en la esquina superior derecha de la app.
3. Tambien puedes usar el modo pantalla completa del navegador en macOS.
4. Deja la pestana abierta. La app consulta `/api/events` cada 10 segundos.

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
