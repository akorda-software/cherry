/**
 * Formateadores de fecha en español de España para chats, matches y likes.
 *
 * Escritos a mano (sin `Intl`) para que el resultado sea idéntico en Hermes (iOS/Android),
 * en web y en los tests. Siempre en la hora local del dispositivo.
 */

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
] as const;

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"] as const;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type DateInput = Date | string | number;

export function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function isValidDate(value: DateInput): boolean {
  return !Number.isNaN(toDate(value).getTime());
}

/** Días naturales entre dos fechas (b − a) en hora local, sin sustos con el cambio de hora. */
export function calendarDaysBetween(a: DateInput, b: DateInput): number {
  const from = toDate(a);
  const to = toDate(b);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / DAY);
}

export function isSameCalendarDay(a: DateInput, b: DateInput): boolean {
  return calendarDaysBetween(a, b) === 0;
}

/** Clave estable del día local (`2026-09-29`), útil para agrupar. */
export function localDayKey(value: DateInput): string {
  const date = toDate(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Hora del mensaje: `9:05`, `14:30` (24 h, como se lee en España). */
export function formatClockTime(value: DateInput): string {
  const date = toDate(value);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** `12 de septiembre` (o `12 de septiembre de 2025` si no es este año). */
export function formatLongDate(value: DateInput, now: DateInput = Date.now()): string {
  const date = toDate(value);
  const base = `${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === toDate(now).getFullYear() ? base : `${base} de ${date.getFullYear()}`;
}

/** Separador de día del chat: «Hoy», «Ayer» o «12 de septiembre». */
export function formatDaySeparator(value: DateInput, now: DateInput = Date.now()): string {
  const days = calendarDaysBetween(value, now);

  if (days === 0) {
    return "Hoy";
  }

  if (days === 1) {
    return "Ayer";
  }

  return formatLongDate(value, now);
}

/**
 * Hora relativa corta para listas (conversaciones, likes):
 * «ahora», «hace 5 min», «hace 3 h», «ayer», «lunes», «12 sept», «12 sept 2025».
 */
export function formatRelativeTime(value: DateInput, now: DateInput = Date.now()): string {
  const date = toDate(value);
  const current = toDate(now);
  const diff = current.getTime() - date.getTime();

  if (Number.isNaN(diff)) {
    return "";
  }

  // Relojes algo desfasados: un mensaje "del futuro" es de ahora mismo.
  if (diff < MINUTE) {
    return "ahora";
  }

  if (diff < HOUR) {
    return `hace ${Math.floor(diff / MINUTE)} min`;
  }

  const days = calendarDaysBetween(date, current);

  if (days === 0 || diff < 6 * HOUR) {
    return `hace ${Math.floor(diff / HOUR)} h`;
  }

  if (days === 1) {
    return "ayer";
  }

  if (days < 7) {
    return WEEKDAYS[date.getDay()];
  }

  const short = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  return date.getFullYear() === current.getFullYear() ? short : `${short} ${date.getFullYear()}`;
}

/** Versión para lectores de pantalla: «hace 5 minutos», «ayer a las 14:30»… */
export function formatRelativeTimeForA11y(value: DateInput, now: DateInput = Date.now()): string {
  const date = toDate(value);
  const current = toDate(now);
  const diff = current.getTime() - date.getTime();

  if (Number.isNaN(diff)) {
    return "";
  }

  if (diff < MINUTE) {
    return "ahora mismo";
  }

  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return minutes === 1 ? "hace 1 minuto" : `hace ${minutes} minutos`;
  }

  const days = calendarDaysBetween(date, current);

  if (days === 0) {
    return `hoy a las ${formatClockTime(date)}`;
  }

  if (days === 1) {
    return `ayer a las ${formatClockTime(date)}`;
  }

  return `el ${formatLongDate(date, current)}`;
}
