/**
 * Fecha de nacimiento en tres campos (DD / MM / AAAA). La edad se calcula igual
 * que en backend (`Cherry.Dating.Profile.age/1`): con la fecha de HOY en UTC y
 * restando un año si el cumpleaños de este año aún no ha llegado (un 29 de
 * febrero cumple el 1 de marzo en años no bisiestos).
 */
export const MIN_AGE = 18;
/** Más allá de esto es casi seguro un error al teclear el año. */
export const MAX_PLAUSIBLE_AGE = 110;
export const MIN_BIRTH_YEAR = 1900;

export interface BirthdayParts {
  day: string;
  month: string;
  year: string;
}

export type BirthdayPart = keyof BirthdayParts;

export const EMPTY_BIRTHDAY: BirthdayParts = { day: "", month: "", year: "" };

export type BirthdayValidation =
  | { status: "incomplete" }
  | { status: "invalid" }
  | { status: "future" }
  | { status: "too_young"; age: number }
  | { status: "implausible"; age: number }
  | { status: "valid"; isoDate: string; age: number };

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function utcCalendarDate(now: Date = new Date()): CalendarDate {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isRealDate({ year, month, day }: CalendarDate): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

function compareCalendar(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Años cumplidos a fecha `today` (misma regla que el backend). */
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const years = today.year - birth.year;
  const birthdayReached = today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return birthdayReached ? years : years - 1;
}

export function parseIsoDate(isoDate: string | null | undefined): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");

  if (!match) {
    return null;
  }

  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isRealDate(date) ? date : null;
}

export function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Edad a partir de `YYYY-MM-DD` (o `null` si la fecha no es válida). */
export function ageFromIsoDate(isoDate: string | null | undefined, now: Date = new Date()): number | null {
  const birth = parseIsoDate(isoDate);
  return birth ? ageOn(birth, utcCalendarDate(now)) : null;
}

export function isAdultBirthDate(isoDate: string | null | undefined, now: Date = new Date()): boolean {
  const age = ageFromIsoDate(isoDate, now);
  return age !== null && age >= MIN_AGE;
}

export function birthdayPartsFromIso(isoDate: string | null | undefined): BirthdayParts {
  const date = parseIsoDate(isoDate);

  if (!date) {
    return { ...EMPTY_BIRTHDAY };
  }

  return {
    day: String(date.day).padStart(2, "0"),
    month: String(date.month).padStart(2, "0"),
    year: String(date.year)
  };
}

const PART_LENGTH: Record<BirthdayPart, number> = { day: 2, month: 2, year: 4 };

/**
 * Normaliza lo tecleado en un campo y dice si ya está completo (para saltar
 * al siguiente). Un 4–9 en el día o un 2–9 en el mes no admiten segunda cifra,
 * así que se rellenan con cero y avanzan solos: «7» → «07».
 */
export function normalizeBirthdayPart(part: BirthdayPart, raw: string): { value: string; complete: boolean } {
  const digits = raw.replace(/\D/g, "").slice(0, PART_LENGTH[part]);

  if (digits.length === 1 && part !== "year") {
    const first = Number(digits);
    const threshold = part === "day" ? 4 : 2;

    if (first >= threshold) {
      return { value: `0${digits}`, complete: true };
    }
  }

  return { value: digits, complete: digits.length === PART_LENGTH[part] };
}

/** Un campo ya tecleado que no puede formar una fecha real (día 00/32, mes 13…). */
export function isBirthdayPartOutOfRange(part: BirthdayPart, value: string): boolean {
  if (value.length < PART_LENGTH[part]) {
    return false;
  }

  const number = Number(value);

  switch (part) {
    case "day":
      return number < 1 || number > 31;
    case "month":
      return number < 1 || number > 12;
    case "year":
      return number < MIN_BIRTH_YEAR;
  }
}

/** `minAge`: la edad mínima de la instancia (`GET /api/config`); 18 por defecto. */
export function validateBirthday(parts: BirthdayParts, now: Date = new Date(), minAge: number = MIN_AGE): BirthdayValidation {
  const { day, month, year } = parts;

  if (day.length < 1 || month.length < 1 || year.length < 4) {
    return { status: "incomplete" };
  }

  if (![day, month, year].every((value) => /^\d+$/.test(value))) {
    return { status: "invalid" };
  }

  const birth = { year: Number(year), month: Number(month), day: Number(day) };

  if (birth.year < MIN_BIRTH_YEAR || !isRealDate(birth)) {
    return { status: "invalid" };
  }

  const today = utcCalendarDate(now);

  if (compareCalendar(birth, today) > 0) {
    return { status: "future" };
  }

  const age = ageOn(birth, today);

  if (age < minAge) {
    return { status: "too_young", age };
  }

  if (age > MAX_PLAUSIBLE_AGE) {
    return { status: "implausible", age };
  }

  return { status: "valid", isoDate: toIsoDate(birth), age };
}
