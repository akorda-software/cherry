import { describe, expect, it } from "vitest";

import { blockedTagsStatus, positiveTagsStatus, tagLimitMessage, tagStateAnnouncement } from "./tag-status";

describe("tag summary texts", () => {
  it("guides towards 3 (minimum) and 5 (recommended) liked tags", () => {
    expect(positiveTagsStatus(0)).toBe("Marca 3 con +");
    expect(positiveTagsStatus(1)).toBe("Te faltan 2");
    expect(positiveTagsStatus(2)).toBe("Te falta 1");
    expect(positiveTagsStatus(3)).toBe("Mejor con 5");
    expect(positiveTagsStatus(4)).toBe("Mejor con 5");
    expect(positiveTagsStatus(5)).toBe("Listo");
    expect(positiveTagsStatus(8)).toBe("Completo");
  });

  it("keeps blocked tags optional", () => {
    expect(blockedTagsStatus(0)).toBe("Opcional · hasta 5");
    expect(blockedTagsStatus(2)).toBe("2 de 5");
    expect(blockedTagsStatus(5)).toBe("Has llegado al máximo de 5");
  });

  it("explains each limit", () => {
    expect(tagLimitMessage("positive")).toMatch(/8 que te gustan/);
    expect(tagLimitMessage("blocked")).toMatch(/5 bloqueadas/);
  });

  it("announces every state in words", () => {
    expect(tagStateAnnouncement("Senderismo", "liked")).toBe("Senderismo: te gusta");
    expect(tagStateAnnouncement("Fumar", "blocked")).toBe("Fumar: bloqueada");
    expect(tagStateAnnouncement("Café", "neutral")).toBe("Café: sin marcar");
  });
});
