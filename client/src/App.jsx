import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { CalendarDays, Delete, Expand, Plus, RefreshCw, X } from 'lucide-react';

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

const syncTimeFormatter = new Intl.DateTimeFormat('es-PR', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit'
});

const firstDayOfWeek = 1;
const shortWeekdays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const useDemoEvents = import.meta.env.VITE_USE_DEMO_EVENTS === 'true';
const keyboardRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', ',', '-'],
  ['/', '&', '@', '#', '$', '?', '!', ':', '(', ')']
];

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

function formatEventDay(date, isToday) {
  if (isToday) {
    return 'HOY';
  }

  const weekday = shortWeekdays[date.getDay()];
  const month = shortMonths[date.getMonth()];
  const day = date.getDate();

  return `${weekday} ${day}, ${month}`;
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

function toCalendarDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeLabel(time) {
  return eventTimeFormatter.format(new Date(`2000-01-01T${time}:00`));
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = (((hour * 60 + minute + minutes) % 1440) + 1440) % 1440;
  const nextHour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const nextMinute = String(totalMinutes % 60).padStart(2, '0');
  return `${nextHour}:${nextMinute}`;
}

function parseEventDate(value) {
  if (typeof value !== 'string') {
    return new Date(value);
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateOnlyMatch) {
    return new Date(value);
  }

  const [, year, month, day] = dateOnlyMatch;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function startOfWeek(date) {
  const next = startOfDay(date);
  const daysSinceWeekStart = (next.getDay() - firstDayOfWeek + 7) % 7;
  next.setDate(next.getDate() - daysSinceWeekStart);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(first, second) {
  return startOfDay(first).getTime() === startOfDay(second).getTime();
}

function eventOverlapsRange(event, rangeStart, rangeEnd) {
  const start = parseEventDate(event.start);
  const end = event.end ? parseEventDate(event.end) : addDays(start, event.allDay ? 1 : 0);
  return start < rangeEnd && end > rangeStart;
}

function eventsForDay(events, date) {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  return events.filter((event) => eventOverlapsRange(event, dayStart, dayEnd));
}

function highlightedEventIds(events, selectedDate) {
  if (events.length === 0) {
    return new Set();
  }

  return new Set(eventsForDay(events, selectedDate).map((event) => event.id));
}

function eventGridLayout(eventCount) {
  if (eventCount <= 1) {
    return { columns: 1, rows: 1, compact: false, dense: false, scrollable: false };
  }

  if (eventCount <= 4) {
    return { columns: 2, rows: Math.ceil(eventCount / 2), compact: false, dense: false, scrollable: false };
  }

  if (eventCount <= 9) {
    return { columns: 3, rows: Math.ceil(eventCount / 3), compact: eventCount > 8, dense: false, scrollable: false };
  }

  if (eventCount <= 16) {
    return { columns: 4, rows: Math.ceil(eventCount / 4), compact: true, dense: false, scrollable: false };
  }

  if (eventCount <= 28) {
    return { columns: 4, rows: Math.ceil(eventCount / 4), compact: true, dense: true, scrollable: false };
  }

  return { columns: 4, rows: 7, compact: true, dense: true, scrollable: true };
}

function isDaytime(date) {
  const hour = date.getHours();
  return hour >= 6 && hour < 18;
}

function DateTimePanel({ calendars, events, selectedDate, onSelectDate, status, syncError, onAddEvent, onRefresh, onFullscreen }) {
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
        <button className="icon-button" onClick={onAddEvent} title="Agregar evento" type="button">
          <Plus size={34} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onRefresh} title="Actualizar" type="button">
          <RefreshCw size={30} aria-hidden="true" />
        </button>
        <button className="icon-button" onClick={onFullscreen} title="Pantalla completa" type="button">
          <Expand size={30} aria-hidden="true" />
        </button>
      </div>

      <MiniCalendar events={events} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      <CalendarList calendars={calendars} />

      <div className="sync-status">
        <div>{status}</div>
        {syncError && <div className="sync-error">{syncError}</div>}
      </div>
    </aside>
  );
}

function EventBoard({ events, activeView, selectedDate }) {
  const visibleEvents = useMemo(() => {
    const baseDate = startOfDay(selectedDate);
    const tomorrow = addDays(baseDate, 1);
    const weekStart = startOfWeek(baseDate);
    const weekEnd = addDays(weekStart, 7);
    const monthStart = startOfMonth(baseDate);
    const monthEnd = nextMonth(baseDate);

    const rangeStart = activeView === 'timeGridDay'
      ? baseDate
      : activeView === 'timeGridWeek'
        ? weekStart
        : monthStart;

    const rangeEnd = activeView === 'timeGridDay'
      ? tomorrow
      : activeView === 'timeGridWeek'
        ? weekEnd
        : monthEnd;

    return events
      .filter((event) => eventOverlapsRange(event, rangeStart, rangeEnd))
      .sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime());
  }, [activeView, events, selectedDate]);

  const isSelectedToday = isSameDay(selectedDate, new Date());
  const titleDate = isSelectedToday ? 'hoy' : fullDateFormatter.format(selectedDate);
  const title = activeView === 'timeGridDay'
    ? `Eventos de ${titleDate}`
    : activeView === 'timeGridWeek'
      ? 'Eventos de la semana'
      : 'Eventos del mes';
  const gridLayout = eventGridLayout(visibleEvents.length);
  const eventGridStyle = {
    '--event-columns': gridLayout.columns,
    '--event-rows': gridLayout.rows
  };
  const highlightedIds = useMemo(
    () => highlightedEventIds(visibleEvents, selectedDate),
    [selectedDate, visibleEvents]
  );
  const boardClassName = [
    'event-board',
    visibleEvents.length === 1 ? 'single-event-board' : '',
    gridLayout.compact ? 'compact-event-board' : '',
    gridLayout.dense ? 'dense-event-board' : '',
    gridLayout.scrollable ? 'scrollable-event-board' : ''
  ].filter(Boolean).join(' ');

  return (
    <section className={boardClassName} aria-label={title}>
      <div className="board-heading">
        <p className="eyebrow">Apple Calendar / iCloud</p>
        <h1>{title}</h1>
      </div>

      {visibleEvents.length === 0 && activeView === 'timeGridDay' ? (
        <div className="empty-board empty-board-blank" aria-hidden="true" />
      ) : visibleEvents.length === 0 ? (
        <div className="empty-board">
          <span>No hay eventos en esta vista.</span>
        </div>
      ) : (
        <div className="event-grid" style={eventGridStyle}>
          {visibleEvents.map((event) => {
            const eventDate = parseEventDate(event.start);
            const isToday = isSameDay(eventDate, new Date());
            const isHighlighted = highlightedIds.has(event.id);

            return (
              <article className={`event-block ${isHighlighted ? 'highlighted-event' : ''}`} key={event.id}>
                <div className="event-accent" style={{ backgroundColor: event.backgroundColor }} />
                <div className="event-head">
                  <div className="event-day">{formatEventDay(eventDate, isToday)}</div>
                  <div className="event-time">{formatEventTime(event)}</div>
                </div>
                <div className="event-title">{event.title}</div>
                <div className="event-meta">
                  <span>{isToday ? 'Hoy' : fullDateFormatter.format(eventDate)}</span>
                  <span className="event-calendar-name">{event.extendedProps?.calendarName}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniCalendar({ events, selectedDate, onSelectDate }) {
  const scrollContainerRef = useRef(null);
  const currentMonthRef = useRef(null);
  const resetTimerRef = useRef(null);
  const currentMonth = useMemo(() => startOfMonth(new Date()), []);
  const currentMonthTime = currentMonth.getTime();

  const miniEvents = useMemo(() => (
    events.map((event) => ({
      id: `mini-${event.id}`,
      title: '',
      start: event.start,
      allDay: true,
      backgroundColor: event.backgroundColor,
      borderColor: event.backgroundColor
    }))
  ), [events]);

  const visibleMonths = useMemo(() => {
    const monthsByKey = new Map();

    Array.from({ length: 25 }, (_, index) => addMonths(currentMonth, index - 12)).forEach((month) => {
      monthsByKey.set(month.toISOString(), month);
    });

    events.forEach((event) => {
      const eventMonth = startOfMonth(parseEventDate(event.start));
      monthsByKey.set(eventMonth.toISOString(), eventMonth);
    });

    return Array.from(monthsByKey.values())
      .sort((first, second) => first.getTime() - second.getTime());
  }, [currentMonth, events]);

  const scrollToCurrentMonth = useCallback((behavior = 'smooth') => {
    if (!scrollContainerRef.current || !currentMonthRef.current) {
      return;
    }

    const top = currentMonthRef.current.offsetTop - scrollContainerRef.current.offsetTop;

    scrollContainerRef.current.scrollTo({
      top,
      behavior
    });
  }, []);

  const scheduleScrollReset = useCallback(() => {
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      scrollToCurrentMonth();
    }, 30000);
  }, [scrollToCurrentMonth]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollToCurrentMonth('auto');
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resetTimerRef.current);
    };
  }, [scrollToCurrentMonth]);

  return (
    <section className="sidebar-section mini-section">
      <div className="section-title">
        <CalendarDays size={22} aria-hidden="true" />
        <span>Mes</span>
      </div>
      <div
        className="mini-calendar-scroll"
        onKeyDown={scheduleScrollReset}
        onPointerDown={scheduleScrollReset}
        onTouchStart={scheduleScrollReset}
        onWheel={scheduleScrollReset}
        ref={scrollContainerRef}
        tabIndex={0}
      >
        {visibleMonths.map((month) => (
          <div
            className="mini-month"
            key={month.toISOString()}
            ref={month.getTime() === currentMonthTime ? currentMonthRef : undefined}
          >
            <div className="mini-month-title">{monthFormatter.format(month)} {month.getFullYear()}</div>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              locale={esLocale}
              firstDay={firstDayOfWeek}
              initialView="dayGridMonth"
              initialDate={month}
              dateClick={(info) => onSelectDate(info.date)}
              dayCellClassNames={(info) => (isSameDay(info.date, selectedDate) ? ['selected-mini-day'] : [])}
              events={miniEvents}
              eventDisplay="block"
              dayMaxEvents={3}
              headerToolbar={false}
              height="auto"
              fixedWeekCount={false}
              showNonCurrentDates={false}
            />
          </div>
        ))}
      </div>
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

function AddEventModal({ calendars, initialDate, open, onClose, onSubmit }) {
  const [calendarId, setCalendarId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => startOfDay(initialDate));
  const [eventTime, setEventTime] = useState('09:00');
  const [isCapsLocked, setIsCapsLocked] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const wasOpenRef = useRef(false);
  const pickerStartMonth = useMemo(() => startOfMonth(new Date()), []);
  const pickerMonths = useMemo(() => (
    Array.from({ length: 96 }, (_, index) => addMonths(pickerStartMonth, index))
  ), [pickerStartMonth]);
  const selectedCalendar = calendars.find((calendar) => calendar.id === calendarId);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setCalendarId((currentId) => (
        calendars.some((calendar) => calendar.id === currentId)
          ? currentId
          : calendars[0]?.id || ''
      ));
      setEventDate(startOfDay(initialDate));
      setEventTime('09:00');
      setEventTitle('');
      setIsCapsLocked(true);
      setError('');
    }

    wasOpenRef.current = open;
  }, [calendars, initialDate, open]);

  useEffect(() => {
    if (open && calendars.length > 0 && !calendars.some((calendar) => calendar.id === calendarId)) {
      setCalendarId(calendars[0].id);
    }
  }, [calendarId, calendars, open]);

  if (!open) {
    return null;
  }

  const appendKey = (value) => setEventTitle((current) => `${current}${value}`);
  const deleteLast = () => setEventTitle((current) => current.slice(0, -1));
  const clearTitle = () => setEventTitle('');

  const handleSubmit = async () => {
    if (!calendarId || eventTitle.trim().length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSubmit({
        calendarId,
        title: eventTitle.trim(),
        date: toCalendarDateInput(eventDate),
        time: eventTime
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="add-event-modal" aria-label="Agregar evento" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Nuevo evento</p>
            <h2>{fullDateFormatter.format(eventDate)}</h2>
          </div>
          <button className="icon-button modal-close" onClick={onClose} title="Cerrar" type="button">
            <X size={30} aria-hidden="true" />
          </button>
        </div>

        <div className="add-event-layout">
          <div className="modal-column">
            <div className="field-label">Calendario</div>
            <div className="calendar-choice-list">
              {calendars.map((calendar) => (
                <button
                  className={calendar.id === calendarId ? 'calendar-choice selected-calendar-choice' : 'calendar-choice'}
                  key={calendar.id}
                  onClick={() => setCalendarId(calendar.id)}
                  type="button"
                >
                  <span className="calendar-swatch" style={{ backgroundColor: calendar.color }} />
                  <span>{calendar.name}</span>
                </button>
              ))}
            </div>

            <div className="field-label">Titulo</div>
            <input
              className="event-title-input"
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="Nombre del evento"
              value={eventTitle}
            />
            <div className="selected-calendar-note">
              {selectedCalendar ? selectedCalendar.name : 'Selecciona un calendario'}
            </div>

            <div className="field-label time-field-label">Hora</div>
            <div className="time-picker">
              <button className="time-adjust-button" onClick={() => setEventTime((current) => addMinutesToTime(current, -60))} type="button">
                -1h
              </button>
              <button className="time-adjust-button" onClick={() => setEventTime((current) => addMinutesToTime(current, -15))} type="button">
                -15
              </button>
              <div className="time-display">{formatTimeLabel(eventTime)}</div>
              <button className="time-adjust-button" onClick={() => setEventTime((current) => addMinutesToTime(current, 15))} type="button">
                +15
              </button>
              <button className="time-adjust-button" onClick={() => setEventTime((current) => addMinutesToTime(current, 60))} type="button">
                +1h
              </button>
            </div>
          </div>

          <div className="modal-calendar-column">
            <div className="field-label">Dia</div>
            <div className="modal-month-scroll">
              {pickerMonths.map((month) => (
                <div className="modal-month" key={month.toISOString()}>
                  <div className="mini-month-title">{monthFormatter.format(month)} {month.getFullYear()}</div>
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    locale={esLocale}
                    firstDay={firstDayOfWeek}
                    initialView="dayGridMonth"
                    initialDate={month}
                    dateClick={(info) => setEventDate(info.date)}
                    dayCellClassNames={(info) => (isSameDay(info.date, eventDate) ? ['selected-mini-day'] : [])}
                    headerToolbar={false}
                    height="auto"
                    fixedWeekCount={false}
                    showNonCurrentDates={false}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="keyboard-column">
            <div className="field-label">Teclado</div>
            <div className="touch-keyboard">
              {keyboardRows.map((row) => (
                <div className="keyboard-row" key={row.join('')}>
                  {row.map((key) => {
                    const displayKey = /^[A-ZÑ]$/.test(key) && !isCapsLocked ? key.toLowerCase() : key;

                    return (
                      <button className="keyboard-key" key={key} onClick={() => appendKey(displayKey)} type="button">
                        {displayKey}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="keyboard-row keyboard-actions">
                <button
                  className={`keyboard-key ${isCapsLocked ? 'active-key' : ''}`}
                  onClick={() => setIsCapsLocked((current) => !current)}
                  type="button"
                >
                  Caps
                </button>
                <button className="keyboard-key wide-key" onClick={() => appendKey(' ')} type="button">Espacio</button>
                <button className="keyboard-key" onClick={deleteLast} title="Borrar" type="button">
                  <Delete size={24} aria-hidden="true" />
                </button>
                <button className="keyboard-key" onClick={clearTitle} type="button">Limpiar</button>
              </div>
            </div>

            {error && <div className="modal-error">{error}</div>}
            <button
              className="add-submit-button"
              disabled={!calendarId || eventTitle.trim().length === 0 || isSaving}
              onClick={handleSubmit}
              type="button"
            >
              {isSaving ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [events, setEvents] = useState(() => (useDemoEvents ? demoData.events : []));
  const [calendars, setCalendars] = useState(() => (useDemoEvents ? demoData.calendars : []));
  const [activeView, setActiveView] = useState('timeGridWeek');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [status, setStatus] = useState(useDemoEvents ? 'Modo demo activo' : 'Cargando eventos de iCloud...');
  const [syncError, setSyncError] = useState('');
  const [isLightMode, setIsLightMode] = useState(() => isDaytime(new Date()));
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const hasRealDataRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchEvents = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setSyncError('');

    try {
      const response = await fetch(`/api/events?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudieron cargar los eventos.');
      }

      const nextEvents = Array.isArray(payload.events) ? payload.events : [];
      const nextCalendars = Array.isArray(payload.calendars) ? payload.calendars : [];

      hasRealDataRef.current = true;
      setEvents(nextEvents);
      setCalendars(nextCalendars);
      setStatus(
        nextEvents.length > 0
          ? `Actualizado ${syncTimeFormatter.format(new Date(payload.fetchedAt || Date.now()))}`
          : 'Sin eventos de iCloud por ahora'
      );
    } catch (requestError) {
      setSyncError(requestError.message);

      if (useDemoEvents && !hasRealDataRef.current) {
        setEvents(demoData.events);
        setCalendars(demoData.calendars);
        setStatus('Backend no disponible. Mostrando datos demo');
      } else {
        setStatus(hasRealDataRef.current ? 'Mostrando los ultimos eventos cargados' : 'No se pudieron cargar eventos reales');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = window.setInterval(fetchEvents, 10000);
    return () => window.clearInterval(interval);
  }, [fetchEvents]);

  useEffect(() => {
    if (isSameDay(selectedDate, new Date())) {
      return undefined;
    }

    const resetTimer = window.setTimeout(() => {
      setSelectedDate(new Date());
    }, 60000);

    return () => window.clearTimeout(resetTimer);
  }, [selectedDate]);

  useEffect(() => {
    const updateTheme = () => setIsLightMode(isDaytime(new Date()));
    const timer = window.setInterval(updateTheme, 60000);

    updateTheme();

    return () => window.clearInterval(timer);
  }, []);

  const requestFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const createEvent = async ({ calendarId, title, date, time }) => {
    setStatus('Agregando evento...');
    setSyncError('');

    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ calendarId, title, date, time })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo agregar el evento.');
    }

    setSelectedDate(parseEventDate(date));
    setIsAddEventOpen(false);
    await fetchEvents();
  };

  return (
    <main className={`wall-calendar ${isLightMode ? 'day-mode' : 'night-mode'}`}>
      <DateTimePanel
        calendars={calendars}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        status={status}
        syncError={syncError}
        onAddEvent={() => setIsAddEventOpen(true)}
        onRefresh={fetchEvents}
        onFullscreen={requestFullscreen}
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

        <EventBoard events={events} activeView={activeView} selectedDate={selectedDate} />
      </section>
      <AddEventModal
        calendars={calendars}
        initialDate={selectedDate}
        onClose={() => setIsAddEventOpen(false)}
        onSubmit={createEvent}
        open={isAddEventOpen}
      />
    </main>
  );
}

export default App;
