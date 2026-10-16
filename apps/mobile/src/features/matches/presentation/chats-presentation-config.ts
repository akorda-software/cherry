/** Política de presentación de Chats; no cambia paginación ni cachés de aplicación. */
export const CHATS_PRESENTATION = {
  relativeTimeIntervalMs: 60_000,
  paginationDistancePx: 240,
  scrollEventThrottleMs: 200
} as const;
