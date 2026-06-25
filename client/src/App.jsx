import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { CalendarDays, Delete, Expand, Plus, RefreshCw, Volume2, X } from 'lucide-react';

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
const importantEventMarker = '🚨';
const workCalendarName = 'trabajo';
const importantEventKeywords = ['alarma', 'alerta', 'sirena'];
const alertWindowMs = 10 * 1000;
const alertRepeatDurationMs = 70 * 1000;
const alertRepeats = Math.floor(alertRepeatDurationMs / alertWindowMs) + 1;
const alertCheckIntervalMs = 1000;
const shortWeekdays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const useDemoEvents = import.meta.env.VITE_USE_DEMO_EVENTS === 'true';
const keyboardRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', ',', '-'],
  ['🚨', '/', '&', '@', '#', '$', '?', '!', ':', '(']
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

const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const periodOptions = ['AM', 'PM'];

function timeFromEvent(event) {
  if (!event || event.allDay) {
    return '09:00';
  }

  const date = parseEventDate(event.start);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function endTimeFromEvent(event) {
  if (!event || event.allDay || !event.end) {
    return '10:00';
  }

  const date = parseEventDate(event.end);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toClockParts(time) {
  const [rawHour, minute] = time.split(':').map(Number);
  const period = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;
  return {
    hour: String(hour),
    minute: String(minute).padStart(2, '0'),
    period
  };
}

function fromClockParts(parts) {
  const hour12 = Number(parts.hour);
  const hour24 = parts.period === 'PM'
    ? (hour12 % 12) + 12
    : hour12 % 12;
  return `${String(hour24).padStart(2, '0')}:${parts.minute}`;
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

function eventSortValue(event) {
  const start = parseEventDate(event.start);
  const day = startOfDay(start).getTime();
  const time = event.allDay ? 0 : start.getTime() - day;

  return [
    String(day).padStart(14, '0'),
    String(time).padStart(8, '0'),
    String(event.allDay ? 0 : 1),
    (event.extendedProps?.calendarName || '').toLocaleLowerCase('es-PR'),
    (event.extendedProps?.calendarId || '').toLocaleLowerCase('es-PR'),
    (event.title || '').toLocaleLowerCase('es-PR'),
    String(event.id || '')
  ].join('|');
}

function compareEvents(first, second) {
  return eventSortValue(first).localeCompare(eventSortValue(second), 'es-PR', {
    numeric: true,
    sensitivity: 'base'
  });
}

function isImportantEvent(event) {
  const title = String(event.title || '');
  const normalizedTitle = title
    .toLocaleLowerCase('es-PR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return title.includes(importantEventMarker)
    || importantEventKeywords.some((keyword) => normalizedTitle.includes(keyword));
}

function isWorkCalendarEvent(event) {
  const calendarName = String(event.extendedProps?.calendarName || '').toLocaleLowerCase('es-PR');
  return calendarName.includes(workCalendarName);
}

function eventAlertId(event) {
  return String(event.extendedProps?.uid || event.id || `${event.title}-${event.start}`);
}

function isSameAlertWindow(now, target) {
  const delta = now.getTime() - target.getTime();
  return delta >= 0 && delta < alertRepeatDurationMs;
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

function DateTimePanel({ calendars, events, selectedDate, onSelectDate, status, syncError, onAddEvent, onRefresh, onFullscreen, onTestAlert }) {
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
        <button className="icon-button" onClick={onTestAlert} title="Probar sirena" type="button">
          <Volume2 size={30} aria-hidden="true" />
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

function EventBoard({ events, activeView, selectedDate, onEditEvent }) {
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
      .sort(compareEvents);
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
            const isEditable = event.extendedProps?.editable && event.extendedProps?.eventUrl;

            return (
              <article
                className={`event-block ${isHighlighted ? 'highlighted-event' : ''} ${isEditable ? 'editable-event' : ''}`}
                key={event.id}
                onKeyDown={isEditable ? (keyEvent) => {
                  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                    keyEvent.preventDefault();
                    onEditEvent(event);
                  }
                } : undefined}
                onClick={isEditable ? () => onEditEvent(event) : undefined}
                role={isEditable ? 'button' : undefined}
                tabIndex={isEditable ? 0 : undefined}
              >
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
    [...events].sort(compareEvents).map((event) => ({
      id: `mini-${event.id}`,
      title: '',
      start: event.start,
      allDay: true,
      backgroundColor: event.backgroundColor,
      borderColor: event.backgroundColor,
      extendedProps: {
        sortKey: eventSortValue(event)
      }
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
              eventOrder="sortKey"
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

function WheelColumn({ disabled, label, onSelect, options, value }) {
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [value]);

  return (
    <div className="time-wheel-column" aria-label={label}>
      {options.map((option) => (
        <button
          className={value === option ? 'time-wheel-option selected-time-option' : 'time-wheel-option'}
          disabled={disabled}
          key={option}
          onClick={() => onSelect(option)}
          ref={value === option ? selectedRef : undefined}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TimeWheel({ disabled, label, onChange, value }) {
  const parts = toClockParts(value);
  const updatePart = (key, nextValue) => {
    onChange(fromClockParts({ ...parts, [key]: nextValue }));
  };

  return (
    <div className={`time-wheel ${disabled ? 'disabled-time-wheel' : ''}`}>
      <div className="time-wheel-label">{label}</div>
      <div className="time-wheel-columns">
        <WheelColumn disabled={disabled} label={`${label} hora`} onSelect={(hour) => updatePart('hour', hour)} options={hourOptions} value={parts.hour} />
        <WheelColumn disabled={disabled} label={`${label} minutos`} onSelect={(minute) => updatePart('minute', minute)} options={minuteOptions} value={parts.minute} />
        <WheelColumn disabled={disabled} label={`${label} periodo`} onSelect={(period) => updatePart('period', period)} options={periodOptions} value={parts.period} />
      </div>
    </div>
  );
}

function useEventAlerts(events) {
  const audioContextRef = useRef(null);
  const firedAlertKeysRef = useRef(new Set());
  const activeAlertTimersRef = useRef(new Map());

  const ensureAudioContext = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    audioContextRef.current ??= new AudioContext();

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume().catch(() => {});
    }

    return audioContextRef.current;
  }, []);

  const playBeep = useCallback(async () => {
    const audioContext = await ensureAudioContext();

    if (!audioContext || audioContext.state !== 'running') {
      return false;
    }

    const startsAt = audioContext.currentTime;
    const tones = [880, 1320, 880, 1320];

    tones.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const toneStartsAt = startsAt + (index * 0.28);
      const toneEndsAt = toneStartsAt + 0.18;

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, toneStartsAt);
      gain.gain.setValueAtTime(0.0001, toneStartsAt);
      gain.gain.exponentialRampToValueAtTime(0.65, toneStartsAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEndsAt);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(toneStartsAt);
      oscillator.stop(toneEndsAt);
    });

    return true;
  }, [ensureAudioContext]);

  const startAlertSequence = useCallback((alertKey) => {
    if (firedAlertKeysRef.current.has(alertKey) || activeAlertTimersRef.current.has(alertKey)) {
      return;
    }

    let hasPlayed = false;
    const playOnce = async () => {
      const didPlay = await playBeep();

      if (didPlay && !hasPlayed) {
        hasPlayed = true;
        firedAlertKeysRef.current.add(alertKey);
      }
    };

    void playOnce();

    const timers = Array.from({ length: alertRepeats - 1 }, (_, index) => (
      window.setTimeout(() => {
        void playOnce();
      }, (index + 1) * alertWindowMs)
    ));

    const cleanupTimer = window.setTimeout(() => {
      activeAlertTimersRef.current.delete(alertKey);
    }, alertRepeatDurationMs + alertWindowMs);

    activeAlertTimersRef.current.set(alertKey, [...timers, cleanupTimer]);
  }, [playBeep]);

  useEffect(() => {
    const unlockAudio = () => {
      void ensureAudioContext();
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [ensureAudioContext]);

  useEffect(() => {
    const checkAlerts = () => {
      const now = new Date();

      events.forEach((event) => {
        const baseAlertId = eventAlertId(event);

        if (event.allDay) {
          if (!isImportantEvent(event) || !eventOverlapsRange(event, startOfDay(now), addDays(startOfDay(now), 1))) {
            return;
          }

          const target = startOfDay(now);
          target.setHours(now.getHours(), 0, 0, 0);

          if (now.getHours() >= 9 && isSameAlertWindow(now, target)) {
            startAlertSequence(`${baseAlertId}:important-all-day:${target.toISOString()}`);
          }

          return;
        }

        const start = parseEventDate(event.start);

        if (isImportantEvent(event) && isSameAlertWindow(now, start)) {
          startAlertSequence(`${baseAlertId}:important:${start.toISOString()}`);
        }

        if (isWorkCalendarEvent(event)) {
          [60, 30, 0].forEach((minutesBefore) => {
            const target = new Date(start);
            target.setMinutes(target.getMinutes() - minutesBefore);

            if (isSameAlertWindow(now, target)) {
              startAlertSequence(`${baseAlertId}:work-${minutesBefore}:${target.toISOString()}`);
            }
          });
        }
      });
    };

    checkAlerts();
    const timer = window.setInterval(checkAlerts, alertCheckIntervalMs);

    return () => window.clearInterval(timer);
  }, [events, startAlertSequence]);

  useEffect(() => () => {
    activeAlertTimersRef.current.forEach((timers) => {
      timers.forEach((timer) => window.clearTimeout(timer));
    });
    activeAlertTimersRef.current.clear();
    audioContextRef.current?.close().catch(() => {});
  }, []);

  return useCallback(() => {
    startAlertSequence(`manual:${Date.now()}`);
  }, [startAlertSequence]);
}

function AddEventModal({ calendars, editingEvent, initialDate, open, onClose, onSubmit }) {
  const [calendarId, setCalendarId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => startOfDay(initialDate));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [isCapsLocked, setIsCapsLocked] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const wasOpenRef = useRef(false);
  const pickerStartMonth = useMemo(() => startOfMonth(new Date()), []);
  const pickerMonths = useMemo(() => (
    Array.from({ length: 96 }, (_, index) => addMonths(pickerStartMonth, index))
  ), [pickerStartMonth]);
  const selectedCalendar = calendars.find((calendar) => calendar.id === calendarId);
  const isEditing = Boolean(editingEvent);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const editingCalendarId = editingEvent?.extendedProps?.calendarId;
      setCalendarId((currentId) => (
        editingCalendarId || calendars.some((calendar) => calendar.id === currentId)
          ? editingCalendarId || currentId
          : calendars[0]?.id || ''
      ));
      setEventDate(editingEvent ? startOfDay(parseEventDate(editingEvent.start)) : startOfDay(initialDate));
      setStartTime(timeFromEvent(editingEvent));
      setEndTime(endTimeFromEvent(editingEvent));
      setIsAllDay(editingEvent?.allDay || false);
      setEventTitle(editingEvent?.title || '');
      setIsCapsLocked(true);
      setError('');
    }

    wasOpenRef.current = open;
  }, [calendars, editingEvent, initialDate, open]);

  useEffect(() => {
    if (open && !isEditing && calendars.length > 0 && !calendars.some((calendar) => calendar.id === calendarId)) {
      setCalendarId(calendars[0].id);
    }
  }, [calendarId, calendars, isEditing, open]);

  if (!open) {
    return null;
  }

  const appendKey = (value) => {
    setEventTitle((current) => `${current}${value}`);
  };
  const deleteLast = () => {
    setEventTitle((current) => current.slice(0, -1));
  };
  const clearTitle = () => {
    setEventTitle('');
  };

  const handleSubmit = async () => {
    if (!calendarId || eventTitle.trim().length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSubmit({
        calendarId,
        eventUrl: editingEvent?.extendedProps?.eventUrl || '',
        uid: editingEvent?.extendedProps?.uid || '',
        title: eventTitle.trim(),
        date: toCalendarDateInput(eventDate),
        startTime,
        endTime,
        allDay: isAllDay
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="add-event-modal" aria-label={isEditing ? 'Editar evento' : 'Agregar evento'} role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{isEditing ? 'Editar evento' : 'Nuevo evento'}</p>
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
                  disabled={isEditing}
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
              className="event-title-input active-text-input"
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="Nombre del evento"
              value={eventTitle}
            />
            <div className="selected-calendar-note">
              {selectedCalendar ? selectedCalendar.name : 'Selecciona un calendario'}
            </div>

            <div className="field-label time-field-label">Hora</div>
            <div className="time-range-picker">
              <TimeWheel disabled={isAllDay} label="Inicio" onChange={setStartTime} value={startTime} />
              <TimeWheel disabled={isAllDay} label="Fin" onChange={setEndTime} value={endTime} />
            </div>
            <button
              className={`all-day-toggle ${isAllDay ? 'active-all-day-toggle' : ''}`}
              onClick={() => setIsAllDay((current) => !current)}
              type="button"
            >
              Todo el dia
              <span>{isAllDay ? 'Si' : 'No'}</span>
            </button>
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
              {isSaving ? (isEditing ? 'Guardando...' : 'Agregando...') : (isEditing ? 'Guardar' : 'Agregar')}
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
  const [editingEvent, setEditingEvent] = useState(null);
  const hasRealDataRef = useRef(false);
  const isFetchingRef = useRef(false);

  const testEventAlert = useEventAlerts(events);

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

  const createEvent = async ({ calendarId, eventUrl, uid, title, date, startTime, endTime, allDay }) => {
    const isEditingEvent = Boolean(eventUrl && uid);
    setStatus(isEditingEvent ? 'Guardando evento...' : 'Agregando evento...');
    setSyncError('');

    const response = await fetch('/api/events', {
      method: isEditingEvent ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ calendarId, eventUrl, uid, title, date, startTime, endTime, allDay })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo agregar el evento.');
    }

    setSelectedDate(parseEventDate(date));
    setIsAddEventOpen(false);
    setEditingEvent(null);
    await fetchEvents();
  };

  const closeEventModal = () => {
    setIsAddEventOpen(false);
    setEditingEvent(null);
  };

  const openAddEvent = () => {
    setEditingEvent(null);
    setIsAddEventOpen(true);
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    setIsAddEventOpen(true);
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
        onAddEvent={openAddEvent}
        onRefresh={fetchEvents}
        onFullscreen={requestFullscreen}
        onTestAlert={testEventAlert}
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

        <EventBoard events={events} activeView={activeView} onEditEvent={openEditEvent} selectedDate={selectedDate} />
      </section>
      <AddEventModal
        calendars={calendars}
        editingEvent={editingEvent}
        initialDate={selectedDate}
        onClose={closeEventModal}
        onSubmit={createEvent}
        open={isAddEventOpen}
      />
    </main>
  );
}

export default App;
