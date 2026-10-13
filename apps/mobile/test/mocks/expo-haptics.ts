/** expo-haptics mock: calls resolve and can be asserted with `vi.mocked(...)`. */
export const ImpactFeedbackStyle = { Light: "light", Medium: "medium", Heavy: "heavy", Soft: "soft", Rigid: "rigid" };
export const NotificationFeedbackType = { Success: "success", Warning: "warning", Error: "error" };
export const selectionAsync = vi.fn(async () => undefined);
export const impactAsync = vi.fn(async () => undefined);
export const notificationAsync = vi.fn(async () => undefined);
