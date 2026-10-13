import { describe, expect, it } from "vitest";

import {
  ageFromIsoDate,
  birthdayPartsFromIso,
  isAdultBirthDate,
  isBirthdayPartOutOfRange,
  normalizeBirthdayPart,
  validateBirthday
} from "./birthday";

const NOW = new Date("2026-09-29T12:00:00Z");

describe("validateBirthday", () => {
  it("is incomplete until the three fields are filled", () => {
    expect(validateBirthday({ day: "", month: "", year: "" }, NOW)).toEqual({ status: "incomplete" });
    expect(validateBirthday({ day: "14", month: "05", year: "199" }, NOW)).toEqual({ status: "incomplete" });
  });

  it("accepts a real adult date and returns ISO + age", () => {
    expect(validateBirthday({ day: "14", month: "05", year: "1996" }, NOW)).toEqual({
      status: "valid",
      isoDate: "1996-05-14",
      age: 30
    });
    expect(validateBirthday({ day: "7", month: "1", year: "1990" }, NOW)).toEqual({
      status: "valid",
      isoDate: "1990-01-07",
      age: 36
    });
  });

  it("rejects dates that do not exist", () => {
    expect(validateBirthday({ day: "31", month: "02", year: "1995" }, NOW).status).toBe("invalid");
    expect(validateBirthday({ day: "29", month: "02", year: "1995" }, NOW).status).toBe("invalid");
    expect(validateBirthday({ day: "31", month: "04", year: "1995" }, NOW).status).toBe("invalid");
    expect(validateBirthday({ day: "00", month: "04", year: "1995" }, NOW).status).toBe("invalid");
    expect(validateBirthday({ day: "10", month: "13", year: "1995" }, NOW).status).toBe("invalid");
    expect(validateBirthday({ day: "10", month: "10", year: "1899" }, NOW).status).toBe("invalid");
  });

  it("accepts 29 February only in leap years", () => {
    expect(validateBirthday({ day: "29", month: "02", year: "1996" }, NOW).status).toBe("valid");
    expect(validateBirthday({ day: "29", month: "02", year: "2000" }, NOW).status).toBe("valid");
    expect(validateBirthday({ day: "29", month: "02", year: "1900" }, NOW).status).toBe("invalid");
  });

  it("flags future dates, minors and implausible ages", () => {
    expect(validateBirthday({ day: "01", month: "01", year: "2030" }, NOW).status).toBe("future");
    expect(validateBirthday({ day: "30", month: "09", year: "2008" }, NOW)).toEqual({ status: "too_young", age: 17 });
    expect(validateBirthday({ day: "01", month: "01", year: "1901" }, NOW)).toEqual({ status: "implausible", age: 125 });
  });

  it("uses the instance's minimum age when it is higher than 18", () => {
    expect(validateBirthday({ day: "14", month: "05", year: "2006" }, NOW, 21)).toEqual({ status: "too_young", age: 20 });
    expect(validateBirthday({ day: "14", month: "05", year: "2005" }, NOW, 21).status).toBe("valid");
  });

  it("turns 18 exactly on the birthday (UTC)", () => {
    expect(validateBirthday({ day: "29", month: "09", year: "2008" }, NOW)).toEqual({
      status: "valid",
      isoDate: "2008-09-29",
      age: 18
    });
    // 23:30 del 28 en UTC: aún no los ha cumplido para el backend.
    const lateEve = new Date("2026-09-28T23:30:00Z");
    expect(validateBirthday({ day: "29", month: "09", year: "2008" }, lateEve).status).toBe("too_young");
  });
});

describe("ageFromIsoDate", () => {
  it("matches the backend rule, including leap-day birthdays", () => {
    expect(ageFromIsoDate("1996-05-14", NOW)).toBe(30);
    expect(ageFromIsoDate("1996-09-30", NOW)).toBe(29);
    expect(ageFromIsoDate("2008-02-29", new Date("2026-02-28T12:00:00Z"))).toBe(17);
    expect(ageFromIsoDate("2008-02-29", new Date("2026-03-01T12:00:00Z"))).toBe(18);
    expect(ageFromIsoDate(null, NOW)).toBeNull();
    expect(ageFromIsoDate("nope", NOW)).toBeNull();
  });

  it("knows who is an adult", () => {
    expect(isAdultBirthDate("2008-09-29", NOW)).toBe(true);
    expect(isAdultBirthDate("2008-09-30", NOW)).toBe(false);
    expect(isAdultBirthDate(undefined, NOW)).toBe(false);
  });
});

describe("normalizeBirthdayPart (auto-advance)", () => {
  it("keeps only digits and caps the length", () => {
    expect(normalizeBirthdayPart("day", "1a2b3")).toEqual({ value: "12", complete: true });
    expect(normalizeBirthdayPart("year", "19966")).toEqual({ value: "1996", complete: true });
    expect(normalizeBirthdayPart("year", "199")).toEqual({ value: "199", complete: false });
  });

  it("pads a day of 4–9 and a month of 2–9 and advances at once", () => {
    expect(normalizeBirthdayPart("day", "4")).toEqual({ value: "04", complete: true });
    expect(normalizeBirthdayPart("day", "9")).toEqual({ value: "09", complete: true });
    expect(normalizeBirthdayPart("day", "3")).toEqual({ value: "3", complete: false });
    expect(normalizeBirthdayPart("month", "2")).toEqual({ value: "02", complete: true });
    expect(normalizeBirthdayPart("month", "1")).toEqual({ value: "1", complete: false });
    expect(normalizeBirthdayPart("month", "0")).toEqual({ value: "0", complete: false });
    expect(normalizeBirthdayPart("year", "2")).toEqual({ value: "2", complete: false });
  });

  it("detects impossible parts as soon as they are typed", () => {
    expect(isBirthdayPartOutOfRange("day", "32")).toBe(true);
    expect(isBirthdayPartOutOfRange("day", "00")).toBe(true);
    expect(isBirthdayPartOutOfRange("day", "3")).toBe(false);
    expect(isBirthdayPartOutOfRange("month", "13")).toBe(true);
    expect(isBirthdayPartOutOfRange("month", "12")).toBe(false);
    expect(isBirthdayPartOutOfRange("year", "1850")).toBe(true);
    expect(isBirthdayPartOutOfRange("year", "185")).toBe(false);
  });
});

describe("birthdayPartsFromIso", () => {
  it("prefills the three fields from a saved date", () => {
    expect(birthdayPartsFromIso("1996-05-14")).toEqual({ day: "14", month: "05", year: "1996" });
    expect(birthdayPartsFromIso(null)).toEqual({ day: "", month: "", year: "" });
    expect(birthdayPartsFromIso("1996-02-31")).toEqual({ day: "", month: "", year: "" });
  });
});
