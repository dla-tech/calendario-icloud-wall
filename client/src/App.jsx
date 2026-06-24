import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import esLocale from '@fullcalendar/core/locales/es';
import { CalendarDays, Expand, RefreshCw } from 'lucide-react';

const viewOptions = [
  { label: 'Dia', value: 'timeGridDay' },
  { label: 'Semana', value: 'timeGridWeek' },
  { label: 'Mes', value: 'dayGridMonth' }
];

const timeFormatter = new Intl.DateTimeFormat('es-PR', {
  hour: 'numeric',
  minute: '2-digit'
});

const weekdayFormatter = new Intl.DateTimeFormat('es-PR', {
  weekday: 'long'
});

const monthFormatter = new Intl.DateTimeFormat('es-PR', {
  month: 'long'
});

const fullDateFormatter = new Intl.DateTimeFormat('es-PR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const eventTimeFormatter = new Intl.DateTimeFormat('es-PR', {
  hour: 'numeric',
  minute: '2-digit'
});

function buildDemoData() {
  const today = startOfDay(new Date());
  const at = (days, hour, minute, durationMinutes) => {
    const start = addDays(today, days);
    start.setHours(hour, minute, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + durationMinutes);

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const calendars = [
    { id: 'demo-family', name: 'Familia', color: '#1f6feb' },
    { id: 'demo-work', name: 'Trabajo', color: '#16a34a' },
    { id: 'demo-home', name: 'Casa', color: '#f97316' }
  ];

  const demoEvents = [
    { id: 'demo-1', title: 'Desayuno y plan del dia', ...at(0, 8, 30, 45), calendar: calendars[0] },
    { id: 'demo-2', title: 'Reunion de proyecto', ...at(0, 10, 0, 60), calendar: calendars[1] },
    { id: 'demo-3', title: 'Cita medica', ...at(0, 14, 15, 45), calendar: calendars[0] },
    { id: 'demo-4', title: 'Comprar supermercado', ...at(0, 18, 0, 60), calendar: calendars[2] },
    { id: 'demo-5', title: 'Llamada con equipo', ...at(1, 9, 30, 30), calendar: calendars[1] },
    { id: 'demo-6', title: 'Cena familiar', ...at(2, 19, 0, 90), calendar: calendars[0] }
  ].map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: false,
    backgroundColor: event.calendar.color,
    borderColor: event.calendar.color,
    extendedProps: {
      calendarId: event.calendar.id,
      calendarName: event.calendar.name,
      demo: true
    }
  }));

  return { calendars, events: demoEvents };
}

const demoData = buildDemoData();

function formatEventTime(event) {
  if (event.allDay) {
    return 'Todo el dia';
  }

  const start = eventTimeFormatter.format(new Date(event.start));
  const end = event.end ? eventTimeFormatter.format(new Date(event.end)) : '';

  return end ? `${start} - ${end}` : start;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(first, second) {
  return startOfDay(first).getTime() === startOfDay(second).getTime();
}

function eventOverlapsRange(event, rangeStart, rangeEnd) {
  const start = new Date(event.start);
  const end = new Date(event.end || event.start);
  return start < rangeEnd && end >= rangeStart;
}

function DateTimePanel({ calendars, status, onRefresh, onFullscreen, isLoading }) {
  const [now, setNow] = useState(new Date());
  const weekday = weekdayFormatter.format(now);
  const month = monthFormatter.format(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside className="date-panel" aria-label="Fecha y hora">
      <div className="date-stack">
        <div className="date-number">{now.getDate()}</div>
        <div className="date-words">
          <span>{weekday}</span>
          <span>{month} {now.getFullYear()}</span>
        </div>
      </div>

      <div className="live-time">{timeFormatter.format(now)}</div>
      <div className="full-date">{fullDateFormatter.format(now)}</div>

      <div className="side-actions">
        <button className="icon-button" onClick={onRefresh} title="Actualizar" type="button">
          <RefreshCw size={30} className={isLoading ? 'spinning' : ''} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onFullscreen} title="Pantalla completa" type="button">
          <Expand size={30} aria-hidden="true" />
        </button>
      </div>

      <MiniCalendar />
      <CalendarList calendars={calendars} />

      <div className="sync-status">{status}</div>
    </aside>
  );
}

function EventBoard({ events, activeView }) {
  const { visibleEvents, hiddenCount } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, 7);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const rangeEnd = activeView === 'timeGridDay'
      ? tomorrow
      : activeView === 'timeGridWeek'
        ? weekEnd
        : monthEnd;

    const filteredEvents = events
      .filter((event) => eventOverlapsRange(event, today, rangeEnd))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return {
      visibleEvents: filteredEvents.slice(0, 8),
      hiddenCount: Math.max(filteredEvents.length - 8, 0)
    };
  }, [activeView, events]);

  const title = activeView === 'timeGridDay'
    ? 'Eventos de hoy'
    : activeView === 'timeGridWeek'
      ? 'Eventos de la semana'
      : 'Eventos del mes';

  return (
    <section className="event-board" aria-label={title}>
      <div className="board-heading">
        <p className="eyebrow">Apple Calendar / iCloud</p>
        <h1>{title}</h1>
        {hiddenCount > 0 && (
          <p className="event-overflow-note">+{hiddenCount} eventos mas en esta vista</p>
        )}
      </div>

      {visibleEvents.length === 0 ? (
        <div className="empty-board">
          <span>No hay eventos en esta vista.</span>
        </div>
      ) : (
        <div className="event-grid">
          {visibleEvents.map((event) => {
            const eventDate = new Date(event.start);
            const isToday = isSameDay(eventDate, new Date());

            return (
              <article className="event-block" key={event.id}>
                <div className="event-accent" style={{ backgroundColor: event.backgroundColor }} />
                <div className="event-time">{formatEventTime(event)}</div>
                <div className="event-title">{event.title}</div>
                <div className="event-meta">
                  <span>{isToday ? 'Hoy' : fullDateFormatter.format(eventDate)}</span>
                  <span>{event.extendedProps?.calendarName}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniCalendar() {
  return (
    <section className="sidebar-section mini-section">
      <div className="section-title">
        <CalendarDays size={22} aria-hidden="true" />
        <span>Mes</span>
      </div>
      <FullCalendar
        plugins={[dayGridPlugin]}
        locale={esLocale}
        initialView="dayGridMonth"
        headerToolbar={false}
        height="auto"
        fixedWeekCount={false}
        dayHeaderFormat={{ weekday: 'narrow' }}
      />
    </section>
  );
}

function CalendarList({ calendars }) {
  return (
    <section className="sidebar-section compact-list">
      <div className="section-title">
        <CalendarDays size={22} aria-hidden="true" />
        <span>Calendarios</span>
      </div>
      <div className="calendar-list">
        {calendars.length === 0 ? (
          <div className="empty-state">Sin calendarios cargados.</div>
        ) : calendars.map((calendar) => (
          <div className="calendar-row" key={calendar.id}>
            <span className="calendar-swatch" style={{ backgroundColor: calendar.color }} />
            <span>{calendar.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [events, setEvents] = useState(demoData.events);
  const [calendars, setCalendars] = useState(demoData.calendars);
  const [activeView, setActiveView] = useState('timeGridDay');
  const [status, setStatus] = useState('Modo demo: configura iCloud para ver tus eventos reales');
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/events');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudieron cargar los eventos.');
      }

      const hasRealEvents = Array.isArray(payload.events) && payload.events.length > 0;
      const hasCalendars = Array.isArray(payload.calendars) && payload.calendars.length > 0;

      setEvents(hasRealEvents ? payload.events : demoData.events);
      setCalendars(hasCalendars ? payload.calendars : demoData.calendars);
      setStatus(
        hasRealEvents
          ? `Actualizado ${eventTimeFormatter.format(new Date(payload.fetchedAt || Date.now()))}`
          : 'Sin eventos de iCloud por ahora: mostrando datos demo'
      );
    } catch (error) {
      setEvents(demoData.events);
      setCalendars(demoData.calendars);
      setStatus(`${error.message}. Mostrando datos demo`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = window.setInterval(fetchEvents, 15000);
    return () => window.clearInterval(interval);
  }, [fetchEvents]);

  const requestFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  return (
    <main className="wall-calendar">
      <DateTimePanel
        calendars={calendars}
        status={status}
        onRefresh={fetchEvents}
        onFullscreen={requestFullscreen}
        isLoading={isLoading}
      />

      <section className="events-stage" aria-label="Eventos">
        <header className="topbar">
          <div className="segmented" aria-label="Cambiar vista">
            {viewOptions.map((option) => (
              <button
                className={activeView === option.value ? 'active' : ''}
                key={option.value}
                onClick={() => setActiveView(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <EventBoard events={events} activeView={activeView} />
      </section>
    </main>
  );
}

export default App;
