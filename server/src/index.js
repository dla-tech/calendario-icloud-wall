import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import ICAL from 'ical.js';
import { createDAVClient } from 'tsdav';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function toIso(icalTime) {
  return icalTime.toJSDate().toISOString();
}

function addDuration(icalTime, duration) {
  const end = icalTime.clone();
  end.addDuration(duration);
  return end;
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
      const duration = event.duration || ICAL.Duration.fromSeconds(60 * 60);
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
          id: `${baseId}-${toIso(event.startDate)}`,
          title,
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
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
            id: `${baseId}-${toIso(next)}`,
            title,
            start: occurrenceStart.toISOString(),
            end: occurrenceEnd.toISOString(),
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

app.get(['/api/events', '/events'], handleEvents);

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
