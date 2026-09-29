import { describe, expect, it } from "vitest";

import {
  calendarDaysBetween,
  formatClockTime,
  formatDaySeparator,
  formatLongDate,
  formatRelativeTime,
  formatRelativeTimeForA11y,
  localDayKey
} from "./time-format";

// Fechas en hora local para que los tests no dependan de la zona horaria de la máquina.
const now = new Date(2026, 8, 29, 18, 30); // martes 29 de septiembre de 2026, 18:30

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000);
}

describe("formatClockTime", () => {
  it("uses 24h time without a leading zero on the hour", () => {
    expect(formatClockTime(new Date(2026, 8, 29, 9, 5))).toBe("9:05");
    expect(formatClockTime(new Date(2026, 8, 29, 14, 30))).toBe("14:30");
    expect(formatClockTime(new Date(2026, 8, 29, 0, 0))).toBe("0:00");
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days, not 24h windows", () => {
    expect(calendarDaysBetween(new Date(2026, 8, 28, 23, 59), new Date(2026, 8, 29, 0, 1))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 8, 29, 0, 1), new Date(2026, 8, 29, 23, 59))).toBe(0);
    expect(calendarDaysBetween(new Date(2026, 2, 28, 12), new Date(2026, 2, 30, 12))).toBe(2);
  });

  it("accepts ISO strings", () => {
    const iso = new Date(2026, 8, 27, 10).toISOString();
    expect(calendarDaysBetween(iso, now)).toBe(2);
  });
});

describe("formatDaySeparator", () => {
  it("says Hoy and Ayer for the last two days", () => {
    expect(formatDaySeparator(new Date(2026, 8, 29, 8), now)).toBe("Hoy");
    expect(formatDaySeparator(new Date(2026, 8, 28, 23, 50), now)).toBe("Ayer");
  });

  it("uses the long Spanish date for older days", () => {
    expect(formatDaySeparator(new Date(2026, 8, 12, 10), now)).toBe("12 de septiembre");
    expect(formatDaySeparator(new Date(2026, 0, 1, 10), now)).toBe("1 de enero");
  });

  it("adds the year when it is not the current one", () => {
    expect(formatDaySeparator(new Date(2025, 11, 31, 10), now)).toBe("31 de diciembre de 2025");
    expect(formatLongDate(new Date(2025, 4, 3), now)).toBe("3 de mayo de 2025");
  });
});

describe("formatRelativeTime", () => {
  it("says ahora for less than a minute (and for small clock skews)", () => {
    expect(formatRelativeTime(minutesAgo(0.5), now)).toBe("ahora");
    expect(formatRelativeTime(new Date(now.getTime() + 30_000), now)).toBe("ahora");
  });

  it("counts minutes during the first hour", () => {
    expect(formatRelativeTime(minutesAgo(1), now)).toBe("hace 1 min");
    expect(formatRelativeTime(minutesAgo(59), now)).toBe("hace 59 min");
  });

  it("counts hours on the same day", () => {
    expect(formatRelativeTime(minutesAgo(60), now)).toBe("hace 1 h");
    expect(formatRelativeTime(new Date(2026, 8, 29, 0, 10), now)).toBe("hace 18 h");
  });

  it("keeps hours shortly after midnight instead of jumping to ayer", () => {
    const earlyMorning = new Date(2026, 8, 29, 1, 0);
    expect(formatRelativeTime(new Date(2026, 8, 28, 22, 0), earlyMorning)).toBe("hace 3 h");
  });

  it("says ayer, then the weekday during the last week", () => {
    expect(formatRelativeTime(new Date(2026, 8, 28, 9, 0), now)).toBe("ayer");
    expect(formatRelativeTime(new Date(2026, 8, 27, 9, 0), now)).toBe("domingo");
    expect(formatRelativeTime(new Date(2026, 8, 23, 9, 0), now)).toBe("miércoles");
  });

  it("uses a short date after a week, with the year only when needed", () => {
    expect(formatRelativeTime(new Date(2026, 8, 12, 9, 0), now)).toBe("12 sept");
    expect(formatRelativeTime(new Date(2025, 10, 3, 9, 0), now)).toBe("3 nov 2025");
  });

  it("returns an empty string for invalid dates", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});

describe("formatRelativeTimeForA11y", () => {
  it("reads naturally", () => {
    expect(formatRelativeTimeForA11y(minutesAgo(0.2), now)).toBe("ahora mismo");
    expect(formatRelativeTimeForA11y(minutesAgo(1), now)).toBe("hace 1 minuto");
    expect(formatRelativeTimeForA11y(minutesAgo(12), now)).toBe("hace 12 minutos");
    expect(formatRelativeTimeForA11y(new Date(2026, 8, 29, 9, 5), now)).toBe("hoy a las 9:05");
    expect(formatRelativeTimeForA11y(new Date(2026, 8, 28, 21, 15), now)).toBe("ayer a las 21:15");
    expect(formatRelativeTimeForA11y(new Date(2026, 8, 12, 9, 0), now)).toBe("el 12 de septiembre");
  });
});

describe("localDayKey", () => {
  it("builds a zero-padded local day key", () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
