import { vi } from "vitest";

export const openAuthSessionAsync = vi.fn(async () => ({ type: "cancel" as const }));
export const openBrowserAsync = vi.fn(async () => ({ type: "opened" as const }));
export const maybeCompleteAuthSession = vi.fn(() => ({ type: "failed" as const }));
