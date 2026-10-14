import { describe, expect, it } from "vitest";

import { filterNfcCountries, flagEmoji, nfcCountryList } from "./nfc-countries";

describe("flagEmoji", () => {
  it("builds the flag from the two letters", () => {
    expect(flagEmoji("ES")).toBe("🇪🇸");
    expect(flagEmoji("EU")).toBe("🇪🇺");
  });

  it("uses the XK flag for Kosovo and nothing for odd codes", () => {
    expect(flagEmoji("KS")).toBe("🇽🇰");
    expect(flagEmoji("E1")).toBe("");
  });
});

describe("nfcCountryList", () => {
  it("names the countries in Spanish and sorts them ignoring accents", () => {
    const list = nfcCountryList(["PE", "ES", "AT", "pe", "DE"]);

    expect(list.map((country) => country.name)).toEqual(["Alemania", "Austria", "España", "Perú"]);
    expect(list[2]).toEqual({ code: "ES", name: "España", flag: "🇪🇸" });
  });

  it("keeps unknown codes with the code as their name", () => {
    expect(nfcCountryList(["QQ"])).toEqual([{ code: "QQ", name: "QQ", flag: "🇶🇶" }]);
  });

  it("gives the laissez-passer and Kosovo a readable name", () => {
    expect(nfcCountryList(["EU", "UN", "KS"]).map((country) => country.name)).toEqual([
      "Kosovo",
      "Naciones Unidas (salvoconducto)",
      "Unión Europea (salvoconducto)"
    ]);
  });
});

describe("filterNfcCountries", () => {
  const countries = nfcCountryList(["ES", "PE", "PT", "FR"]);

  it("matches part of the name without accents or case", () => {
    expect(filterNfcCountries(countries, "peru").map((country) => country.code)).toEqual(["PE"]);
    expect(filterNfcCountries(countries, "  ESP ").map((country) => country.code)).toEqual(["ES"]);
  });

  it("matches the exact code and returns everything for an empty query", () => {
    expect(filterNfcCountries(countries, "pt").map((country) => country.code)).toEqual(["PT"]);
    expect(filterNfcCountries(countries, " ")).toHaveLength(4);
  });
});
