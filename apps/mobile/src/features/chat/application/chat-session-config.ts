/** Technical realtime policy. Message limits/validation stay in the domain and backend. */
export const CHAT_PAGE_SIZE = 40;
export const PUSH_TIMEOUT_MS = 10_000;
export const TYPING_TTL_MS = 4_000;
export const TYPING_THROTTLE_MS = 3_000;
export const TYPING_PUSH_TIMEOUT_MS = 5_000;
export const AUTO_RETRY_DELAY_MS = 1_500;
export const MAX_AUTO_ATTEMPTS = 2;
export const MARK_READ_DEBOUNCE_MS = 400;
export const MARK_READ_RETRY_INITIAL_MS = 1_500;
export const MARK_READ_RETRY_MAX_MS = 30_000;
export const MARK_READ_RETRY_JITTER = 0.2;
export const TOKEN_REFRESH_MIN_INTERVAL_MS = 4_000;
export const SOCKET_RECONNECT_DELAYS_MS = Object.freeze([250, 1_000, 2_000, 4_000]);
export const SOCKET_RECONNECT_MAX_MS = 8_000;
export const CHANNEL_REJOIN_DELAYS_MS = Object.freeze([1_000, 2_000, 5_000]);
export const CHANNEL_REJOIN_MAX_MS = 10_000;
