import { COUNTRY_NAMES } from "./country-names";

export interface NfcCountry {
  code: string;
  name: string;
  flag: string;
}

/** Bandera emoji de un código alfa-2. Kosovo firma como `KS`, pero su bandera es `XK`. */
export function flagEmoji(code: string): string {
  const flagCode = code === "KS" ? "XK" : code;
  if (!/^[A-Z]{2}$/.test(flagCode)) {
    return "";
  }
  return String.fromCodePoint(...[...flagCode].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

/** Sin tildes ni mayúsculas, para ordenar y buscar («peru» encuentra «Perú»). */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Los códigos del servidor, con nombre y bandera, en orden alfabético por nombre. */
export function nfcCountryList(codes: readonly string[]): NfcCountry[] {
  return [...new Set(codes.map((code) => code.toUpperCase()))]
    .map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code, flag: flagEmoji(code) }))
    .sort((a, b) => {
      const left = foldText(a.name);
      const right = foldText(b.name);
      return left < right ? -1 : left > right ? 1 : 0;
    });
}

/** Filtra por nombre o código, sin tener en cuenta tildes ni mayúsculas. */
export function filterNfcCountries(countries: readonly NfcCountry[], query: string): NfcCountry[] {
  const needle = foldText(query.trim());
  if (!needle) {
    return [...countries];
  }
  return countries.filter((country) => foldText(country.name).includes(needle) || country.code.toLowerCase() === needle);
}
