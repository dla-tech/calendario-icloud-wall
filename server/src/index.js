import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import ICAL from 'ical.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
let createDAVClientPromise;

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

app.use(cors());
app.use(express.json());

const requiredEnv = ['ICLOUD_USERNAME', 'ICLOUD_APP_PASSWORD', 'CALDAV_SERVER'];

function assertConfig() {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `Faltan variables en .env: ${missing.join(', ')}`;
    const error = new Error(message);
    error.status = 500;
    throw error;
  }
}

function getDefaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setDate(start.getDate() - 14);

  const end = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  end.setDate(end.getDate() + 14);

  return { start, end };
}

function getRequestedRange(query) {
  const fallback = getDefaultRange();
  const start = query.start ? new Date(query.start) : fallback.start;
  const end = query.end ? new Date(query.end) : fallback.end;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('Los parametros start/end deben ser fechas validas.');
    error.status = 400;
    throw error;
  }

  return { start, end };
}

function assertText(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const error = new Error(`${fieldName} es requerido.`);
    error.status = 400;
    throw error;
  }

  return value.trim();
}

function assertCalendarDate(value) {
  const date = assertText(value, 'La fecha');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error('La fecha debe usar el formato YYYY-MM-DD.');
    error.status = 400;
    throw error;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('La fecha no es valida.');
    error.status = 400;
    throw error;
  }

  return date;
}

function assertEventTime(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const time = assertText(value, 'La hora');

  if (!/^\d{2}:\d{2}$/.test(time)) {
    const error = new Error('La hora debe usar el formato HH:mm.');
    error.status = 400;
    throw error;
  }

  const [hour, minute] = time.split(':').map(Number);

  if (hour > 23 || minute > 59) {
    const error = new Error('La hora no es valida.');
    error.status = 400;
    throw error;
  }

  return time;
}

function toIso(icalTime) {
  return icalTime.toJSDate().toISOString();
}

function toIcsDate(date) {
  return date.replaceAll('-', '');
}

function toIcsDateTime(date, time) {
  return `${toIcsDate(date)}T${time.replace(':', '')}00`;
}

function toCalendarDate(icalTime) {
  const month = String(icalTime.month).padStart(2, '0');
  const day = String(icalTime.day).padStart(2, '0');
  return `${icalTime.year}-${month}-${day}`;
}

function serializeEventTime(icalTime, allDay) {
  return allDay ? toCalendarDate(icalTime) : toIso(icalTime);
}

function addDuration(icalTime, duration) {
  const end = icalTime.clone();
  end.addDuration(duration);
  return end;
}

function addCalendarDate(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function addTime(date, time, minutes) {
  const parsed = new Date(`${date}T${time}:00Z`);
  parsed.setUTCMinutes(parsed.getUTCMinutes() + minutes);

  return {
    date: parsed.toISOString().slice(0, 10),
    time: parsed.toISOString().slice(11, 16)
  };
}

function getEventDuration(event) {
  if (event.duration) {
    return event.duration;
  }

  return event.startDate?.isDate
    ? ICAL.Duration.fromSeconds(24 * 60 * 60)
    : ICAL.Duration.fromSeconds(60 * 60);
}

function isInRange(start, end, rangeStart, rangeEnd) {
  return start < rangeEnd && end > rangeStart;
}

function calendarColor(calendar, index) {
  const palette = ['#2563eb', '#16a34a', '#f97316', '#db2777', '#7c3aed', '#0891b2'];
  return calendar.calendarColor || calendar.color || palette[index % palette.length];
}

function isEventCalendar(calendar) {
  const components = Array.isArray(calendar.components) ? calendar.components : [];
  const supportsEvents = components.length === 0 || components.includes('VEVENT');
  const calendarLabel = `${calendar.displayName || ''} ${calendar.url || ''}`.toLowerCase();
  const looksLikeReminders = calendarLabel.includes('reminder') || calendarLabel.includes('recordatorio');

  return supportsEvents && !looksLikeReminders;
}

function escapeIcsText(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldIcsLine(line) {
  const limit = 73;
  const chunks = [];
  let remaining = line;

  while (remaining.length > limit) {
    chunks.push(remaining.slice(0, limit));
    remaining = ` ${remaining.slice(limit)}`;
  }

  chunks.push(remaining);
  return chunks.join('\r\n');
}

function createAllDayIcs({ title, date, uid }) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const start = toIcsDate(date);
  const end = toIcsDate(addCalendarDate(date, 1));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendario iCloud Wall//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `CREATED:${now}`,
    `LAST-MODIFIED:${now}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function createTimedIcs({ title, date, time, uid }) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const end = addTime(date, time, 60);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendario iCloud Wall//ES',
    'CALSCALE:GREGORIAN',
    'X-WR-TIMEZONE:America/Puerto_Rico',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `CREATED:${now}`,
    `LAST-MODIFIED:${now}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DTSTART;TZID=America/Puerto_Rico:${toIcsDateTime(date, time)}`,
    `DTEND;TZID=America/Puerto_Rico:${toIcsDateTime(end.date, end.time)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

async function getCreateDAVClient() {
  createDAVClientPromise ??= import('tsdav')
    .then((module) => module.createDAVClient || module.default?.createDAVClient)
    .catch(() => require('tsdav').createDAVClient);

  const createDAVClient = await createDAVClientPromise;

  if (typeof createDAVClient !== 'function') {
    const error = new Error('No se pudo cargar createDAVClient desde tsdav.');
    error.status = 500;
    throw error;
  }

  return createDAVClient;
}

function parseCalendarObject(calendarObject, calendar, calendarIndex, rangeStart, rangeEnd) {
  if (!calendarObject.data) {
    return [];
  }

  try {
    const jcal = ICAL.parse(calendarObject.data);
    const component = new ICAL.Component(jcal);
    const vevents = component.getAllSubcomponents('vevent');
    const color = calendarColor(calendar, calendarIndex);

    return vevents.flatMap((vevent) => {
      const event = new ICAL.Event(vevent);
      const duration = getEventDuration(event);
      const title = event.summary || 'Sin titulo';
      const calendarName = calendar.displayName || calendar.url || 'iCloud';
      const baseId = event.uid || calendarObject.url || `${title}-${event.startDate}`;
      const allDay = event.startDate?.isDate ?? false;

      if (!event.isRecurring()) {
        const eventStart = event.startDate.toJSDate();
        const eventEnd = event.endDate ? event.endDate.toJSDate() : addDuration(event.startDate, duration).toJSDate();

        if (!isInRange(eventStart, eventEnd, rangeStart, rangeEnd)) {
          return [];
        }

        return [{
          id: `${baseId}-${serializeEventTime(event.startDate, allDay)}`,
          title,
          start: serializeEventTime(event.startDate, allDay),
          end: serializeEventTime(event.endDate || addDuration(event.startDate, duration), allDay),
          allDay,
          backgroundColor: color,
          borderColor: color,
          extendedProps: {
            calendarId: calendar.url,
            calendarName,
            location: event.location || '',
            description: event.description || ''
          }
        }];
      }

      const expansion = new ICAL.RecurExpansion({
        component: vevent,
        dtstart: event.startDate
      });

      const occurrences = [];
      let next = expansion.next();
      let guard = 0;

      while (next && guard < 500) {
        const occurrenceStart = next.toJSDate();
        const occurrenceEnd = addDuration(next, duration).toJSDate();

        if (occurrenceStart >= rangeEnd) {
          break;
        }

        if (isInRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
          occurrences.push({
            id: `${baseId}-${serializeEventTime(next, allDay)}`,
            title,
            start: serializeEventTime(next, allDay),
            end: serializeEventTime(addDuration(next, duration), allDay),
            allDay,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              calendarId: calendar.url,
              calendarName,
              location: event.location || '',
              description: event.description || ''
            }
          });
        }

        next = expansion.next();
        guard += 1;
      }

      return occurrences;
    });
  } catch (error) {
    console.warn(`No se pudo leer un evento de ${calendar.displayName || calendar.url}:`, error.message);
    return [];
  }
}

async function fetchICloudEvents(rangeStart, rangeEnd) {
  assertConfig();

  const createDAVClient = await getCreateDAVClient();
  const client = await createDAVClient({
    serverUrl: process.env.CALDAV_SERVER,
    credentials: {
      username: process.env.ICLOUD_USERNAME,
      password: process.env.ICLOUD_APP_PASSWORD
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav'
  });

  const calendars = (await client.fetchCalendars()).filter(isEventCalendar);

  const calendarResults = await Promise.all(
    calendars.map(async (calendar, index) => {
      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString()
        }
      });

      const events = objects.flatMap((object) => parseCalendarObject(object, calendar, index, rangeStart, rangeEnd));

      return {
        calendar: {
          id: calendar.url,
          name: calendar.displayName || `Calendario ${index + 1}`,
          color: calendarColor(calendar, index)
        },
        events
      };
    })
  );

  const events = calendarResults
    .flatMap((result) => result.events)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    calendars: calendarResults.map((result) => result.calendar),
    events,
    fetchedAt: new Date().toISOString()
  };
}

async function createICloudEvent({ calendarId, title, date, time }) {
  assertConfig();

  const targetCalendarId = assertText(calendarId, 'El calendario');
  const eventTitle = assertText(title, 'El titulo');
  const eventDate = assertCalendarDate(date);
  const eventTime = assertEventTime(time);
  const createDAVClient = await getCreateDAVClient();
  const client = await createDAVClient({
    serverUrl: process.env.CALDAV_SERVER,
    credentials: {
      username: process.env.ICLOUD_USERNAME,
      password: process.env.ICLOUD_APP_PASSWORD
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav'
  });
  const calendars = (await client.fetchCalendars()).filter(isEventCalendar);
  const calendar = calendars.find((candidate) => candidate.url === targetCalendarId);

  if (!calendar) {
    const error = new Error('No se encontro ese calendario.');
    error.status = 404;
    throw error;
  }

  const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}@calendario-icloud-wall`;
  const calendarUrl = new URL(calendar.url, process.env.CALDAV_SERVER);

  if (!calendarUrl.pathname.endsWith('/')) {
    calendarUrl.pathname = `${calendarUrl.pathname}/`;
  }

  const objectUrl = new URL(`${uid}.ics`, calendarUrl.href).href;
  const response = await fetch(objectUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.ICLOUD_USERNAME}:${process.env.ICLOUD_APP_PASSWORD}`).toString('base64')}`,
      'Content-Type': 'text/calendar; charset=utf-8',
      'If-None-Match': '*'
    },
    body: eventTime
      ? createTimedIcs({ title: eventTitle, date: eventDate, time: eventTime, uid })
      : createAllDayIcs({ title: eventTitle, date: eventDate, uid })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    const error = new Error(`No se pudo crear el evento en iCloud (${response.status}). ${message}`.trim());
    error.status = response.status;
    throw error;
  }

  return {
    id: uid,
    title: eventTitle,
    date: eventDate,
    time: eventTime,
    calendarId: calendar.url,
    calendarName: calendar.displayName || calendar.url || 'iCloud'
  };
}

async function handleEvents(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { start, end } = getRequestedRange(req.query);
    const payload = await fetchICloudEvents(start, end);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function handleCreateEvent(req, res, next) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const payload = await createICloudEvent(req.body || {});
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
}

app.get(['/api/events', '/events'], handleEvents);
app.post(['/api/events', '/events'], handleCreateEvent);

app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ ok: true, service: 'calendario-icloud-wall-server' });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  console.error(error);
  res.status(status).json({
    error: error.message || 'Error interno del servidor'
  });
});

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Servidor listo en http://127.0.0.1:${port}`);
  });
}

export default app;
