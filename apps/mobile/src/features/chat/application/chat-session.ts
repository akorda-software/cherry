import { Socket, type Channel } from "phoenix";

import type { ChatMessage, ChatTypingEvent, ConversationMessagesPage } from "@snack/contracts";

import {
  mergeMessages,
  pagesOverlap,
  reconcileOutbox,
  sortNewestFirst,
  validateMessageBody,
  type OutgoingMessage
} from "../domain/chat-messages";

/**
 * Sesión de una conversación en tiempo real (sin React):
 * - historial por REST (fuente de verdad) con paginación hacia atrás;
 * - canal Phoenix `chat:{conversationId}` para `new_message` y `typing`;
 * - envío optimista por el canal (o por REST si el canal no está unido), con reintento
 *   automático, reintento manual y reconciliación para no duplicar nunca un mensaje;
 * - reconexión con token refrescado y backfill REST fusionando por `id`;
 * - marcar como leído al abrir y al recibir con la pantalla visible.
 *
 * La UI se suscribe con `subscribe`/`getState` (compatible con `useSyncExternalStore`).
 */

export type ChatSessionStatus = "loading" | "ready" | "error" | "unavailable";
/** `live` = canal unido; `connecting` = conectando o reconectando; `offline` = en pausa o cerrado. */
export type ChatConnection = "offline" | "connecting" | "live";

export interface ChatSessionState {
  conversationId: string;
  status: ChatSessionStatus;
  /** Error de la carga inicial (para `friendlyErrorMessage`). */
  error: unknown;
  /** `not_participant` | `conversation_not_active` | `profile_required` | `profile_not_found`. */
  unavailableReason: string | null;
  connection: ChatConnection;
  /** Mensajes del servidor, de más nuevo a más antiguo. */
  messages: ChatMessage[];
  /** Envíos optimistas (en orden de envío). */
  outbox: OutgoingMessage[];
  /** id del servidor → clientId del envío optimista del que viene (clave estable en la lista). */
  keyAliases: ReadonlyMap<string, string>;
  /** Claves de mensajes llegados o enviados en vivo durante esta sesión (se animan al aparecer). */
  liveKeys: ReadonlySet<string>;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: boolean;
  otherTyping: boolean;
  myProfileId: string | null;
  otherProfileId: string | null;
}

export interface ChatSessionApi {
  listMessages(query?: { cursor?: string | null; limit?: number }): Promise<ConversationMessagesPage>;
  sendMessage(body: string): Promise<ChatMessage>;
  markRead(): Promise<void>;
}

export interface ChatSessionEvents {
  /** Cambió el mensaje más reciente (para la vista previa en la lista de chats). */
  onLatestMessage?(message: ChatMessage, mine: boolean): void;
  /** La conversación quedó leída para mí (tras `markRead` o tras enviar). */
  onRead?(): void;
  /** Mensaje nuevo de la otra persona recibido en vivo. */
  onIncomingMessage?(message: ChatMessage): void;
  /** La conversación ya no está disponible (deshecho, bloqueo, cuenta borrada…). */
  onUnavailable?(reason: string): void;
}

export type SocketConstructor = new (endPoint: string, options?: Record<string, unknown>) => Socket;

export interface ChatSessionOptions {
  conversationId: string;
  /** `ws(s)://host/socket`; `null` = solo REST (sin tiempo real). */
  socketUrl: string | null;
  api: ChatSessionApi;
  /**
   * Token para el socket. `fresh: false` = el guardado; `fresh: true` tras una caída o un rechazo:
   * debe validarlo contra el backend y refrescarlo si caducó (vía `executeAuthenticated`).
   */
  getSocketToken(options: { fresh: boolean }): Promise<string>;
  otherProfileId?: string | null;
  events?: ChatSessionEvents;
  pageSize?: number;
  now?: () => number;
  createClientId?: () => string;
  SocketImpl?: SocketConstructor;
}

export const CHAT_PAGE_SIZE = 40;
export const PUSH_TIMEOUT_MS = 10_000;
export const TYPING_TTL_MS = 4_000;
export const TYPING_THROTTLE_MS = 3_000;
export const AUTO_RETRY_DELAY_MS = 1_500;
/** Intentos automáticos por envío antes de mostrar «no se ha podido enviar · reintentar». */
export const MAX_AUTO_ATTEMPTS = 2;
export const MARK_READ_DEBOUNCE_MS = 400;
export const TOKEN_REFRESH_MIN_INTERVAL_MS = 4_000;

const UNAVAILABLE_REASONS = new Set([
  "not_participant",
  "conversation_not_active",
  "profile_required",
  "profile_not_found"
]);

export type TransmitResult =
  | { kind: "ok"; message: ChatMessage }
  | { kind: "unavailable"; reason: string }
  | { kind: "invalid" }
  | { kind: "transient"; ambiguous: boolean };

export interface ChatSession {
  getState(): ChatSessionState;
  subscribe(listener: () => void): () => void;
  /** Carga el historial y abre el tiempo real. */
  start(): void;
  /** Reintenta la carga inicial tras un error. */
  retryLoad(): void;
  loadOlder(): Promise<void>;
  /** Envía un mensaje (optimista). Devuelve el envío creado o `null` si el texto no es válido. */
  send(body: string): OutgoingMessage | null;
  retry(clientId: string): void;
  /** Descarta un envío fallido. */
  discard(clientId: string): void;
  /** Avisa de que estoy escribiendo (con throttle). */
  notifyTyping(): void;
  /** La pantalla está visible (enfocada y la app en primer plano). */
  setVisible(visible: boolean): void;
  setOtherProfileId(profileId: string | null): void;
  /** App en segundo plano: suelta el socket. */
  pause(): void;
  /** App de vuelta: backfill y reconexión inmediata. */
  resume(): void;
  dispose(): void;
}

let clientIdCounter = 0;

function defaultClientId(): string {
  clientIdCounter += 1;
  return `local-${Date.now().toString(36)}-${clientIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createChatSession(options: ChatSessionOptions): ChatSession {
  const {
    conversationId,
    socketUrl,
    api,
    getSocketToken,
    events = {},
    pageSize = CHAT_PAGE_SIZE,
    now = () => Date.now(),
    createClientId = defaultClientId,
    SocketImpl = Socket as unknown as SocketConstructor
  } = options;

  let state: ChatSessionState = {
    conversationId,
    status: "loading",
    error: null,
    unavailableReason: null,
    connection: "offline",
    messages: [],
    outbox: [],
    keyAliases: new Map(),
    liveKeys: new Set(),
    hasOlder: false,
    loadingOlder: false,
    olderError: false,
    otherTyping: false,
    myProfileId: null,
    otherProfileId: options.otherProfileId ?? null
  };

  const listeners = new Set<() => void>();
  let cursor: string | null = null;
  let disposed = false;
  let started = false;
  let paused = false;
  let visible = false;

  let socket: Socket | null = null;
  let channel: Channel | null = null;
  let channelJoined = false;
  let token: string | null = null;
  let connectInFlight = false;

  let loadInFlight = false;
  let backfillInFlight: Promise<void> | null = null;
  let tokenRefreshInFlight: Promise<void> | null = null;
  let lastTokenRefreshAt = -Infinity;

  let readPending = false;
  let markReadTimer: ReturnType<typeof setTimeout> | null = null;
  let markReadInFlight = false;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTypingSentAt = -Infinity;
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // ── Estado ────────────────────────────────────────────────────────────

  function setState(patch: Partial<ChatSessionState>) {
    if (disposed) {
      return;
    }

    const previousLatest = state.messages[0];
    state = { ...state, ...patch };
    const latest = state.messages[0];

    if (latest && latest !== previousLatest && latest.id !== previousLatest?.id) {
      events.onLatestMessage?.(latest, isMine(latest));
    }

    listeners.forEach((listener) => listener());
  }

  function currentStatus(): ChatSessionStatus {
    return state.status;
  }

  function isMine(message: ChatMessage): boolean {
    if (state.myProfileId !== null) {
      return message.senderProfileId === state.myProfileId;
    }

    if (state.otherProfileId !== null) {
      return message.senderProfileId !== state.otherProfileId;
    }

    return false;
  }

  /** Aprende quién soy a partir de mensajes cuyo remitente no es la otra persona. */
  function learnIdentity(messages: readonly ChatMessage[]): Partial<ChatSessionState> {
    if (state.myProfileId !== null || state.otherProfileId === null) {
      return {};
    }

    const mine = messages.find((message) => message.senderProfileId !== state.otherProfileId);
    return mine ? { myProfileId: mine.senderProfileId } : {};
  }

  function withLiveKeys(keys: readonly string[]): ReadonlySet<string> {
    if (keys.length === 0) {
      return state.liveKeys;
    }

    const next = new Set(state.liveKeys);
    keys.forEach((key) => next.add(key));
    return next;
  }

  function withAliases(entries: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
    if (entries.size === 0) {
      return state.keyAliases;
    }

    const next = new Map(state.keyAliases);
    // `delivered` es clientId → id; el alias se guarda como id → clientId.
    entries.forEach((messageId, clientId) => next.set(messageId, clientId));
    return next;
  }

  function findOutgoing(clientId: string): OutgoingMessage | undefined {
    return state.outbox.find((item) => item.clientId === clientId);
  }

  function updateOutgoing(clientId: string, patch: Partial<OutgoingMessage>) {
    setState({
      outbox: state.outbox.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item))
    });
  }

  /**
   * Incorpora mensajes del servidor: dedup por id, reconciliación de la cola optimista con los
   * mensajes propios y avisos de mensajes ajenos nuevos.
   */
  function absorb(
    incoming: readonly ChatMessage[],
    {
      tie,
      live,
      replace = false,
      patch = {}
    }: { tie: "newer" | "older"; live: boolean; replace?: boolean; patch?: Partial<ChatSessionState> }
  ): ChatMessage[] {
    const relevant = incoming.filter((message) => message.conversationId === conversationId);
    const { messages, added } = mergeMessages(replace ? [] : state.messages, relevant, tie);

    if (added.length === 0) {
      if (Object.keys(patch).length > 0) {
        setState(patch);
      }
      return added;
    }

    const identity = learnIdentity(added);
    const myProfileId = identity.myProfileId ?? state.myProfileId;
    const mineOf = (message: ChatMessage) =>
      myProfileId !== null
        ? message.senderProfileId === myProfileId
        : state.otherProfileId !== null
          ? message.senderProfileId !== state.otherProfileId
          : // Sin saber quién es quién: si coincide con un envío pendiente, es mío.
            state.outbox.some((item) => item.body === message.body);

    const own = added.filter(mineOf);
    // Solo lo nuevo cuenta para «escribiendo…» y para marcar como leído (no las páginas antiguas).
    const theirs = tie === "newer" ? added.filter((message) => !mineOf(message)) : [];
    const { outbox, delivered } = reconcileOutbox(state.outbox, own);
    delivered.forEach((_, clientId) => clearRetryTimer(clientId));

    const liveKeys = live
      ? added.map((message) => {
          const alias = [...delivered.entries()].find(([, id]) => id === message.id)?.[0];
          return alias ?? message.id;
        })
      : [];

    setState({
      ...patch,
      ...identity,
      messages,
      outbox,
      keyAliases: withAliases(delivered),
      liveKeys: withLiveKeys(liveKeys),
      ...(theirs.length > 0 ? { otherTyping: false } : {})
    });

    if (theirs.length > 0) {
      clearTypingTimer();
      readPending = true;
      if (live) {
        theirs.forEach((message) => events.onIncomingMessage?.(message));
      }
      scheduleMarkRead();
    }

    return added;
  }

  // ── Historial ─────────────────────────────────────────────────────────

  async function loadInitial() {
    if (loadInFlight || disposed) {
      return;
    }

    loadInFlight = true;
    setState({ status: "loading", error: null });

    try {
      const page = await api.listMessages({ limit: pageSize });

      if (disposed) {
        return;
      }

      const incoming = sortNewestFirst(page.messages);
      const merged = mergeMessages(state.messages, incoming, "older");
      cursor = page.nextCursor;
      readPending = true;
      setState({
        ...learnIdentity(incoming),
        status: "ready",
        messages: merged.messages,
        hasOlder: page.nextCursor !== null,
        olderError: false
      });

      scheduleMarkRead(0);
      void connect();
    } catch (error) {
      if (disposed) {
        return;
      }

      const reason = unavailableReasonOf(error);
      if (reason) {
        markUnavailable(reason);
      } else {
        setState({ status: "error", error });
      }
    } finally {
      loadInFlight = false;
    }
  }

  /** Trae la página más reciente y la fusiona (tras reconectar, volver a primer plano, reintentos). */
  function backfill(): Promise<void> {
    if (backfillInFlight) {
      return backfillInFlight;
    }

    if (disposed || state.status !== "ready") {
      return Promise.resolve();
    }

    backfillInFlight = (async () => {
      try {
        const page = await api.listMessages({ limit: pageSize });

        if (disposed) {
          return;
        }

        const incoming = sortNewestFirst(page.messages);
        const hadMessages = state.messages.length > 0;

        if (hadMessages && page.nextCursor !== null && !pagesOverlap(state.messages, incoming)) {
          // Hueco entre lo que teníamos y lo nuevo: nos quedamos con lo nuevo y se pagina desde ahí.
          cursor = page.nextCursor;
          absorb(incoming, {
            tie: "newer",
            live: false,
            replace: true,
            patch: { hasOlder: true, olderError: false }
          });
          return;
        }

        if (!hadMessages) {
          cursor = page.nextCursor;
        }

        absorb(incoming, {
          tie: "newer",
          live: false,
          patch: hadMessages ? {} : { hasOlder: page.nextCursor !== null }
        });
      } catch (error) {
        const reason = unavailableReasonOf(error);
        if (reason) {
          markUnavailable(reason);
        }
        // Errores transitorios: el siguiente backfill (reconexión, primer plano) lo arreglará.
      } finally {
        backfillInFlight = null;
      }
    })();

    return backfillInFlight;
  }

  async function loadOlder(): Promise<void> {
    if (disposed || state.status !== "ready" || !state.hasOlder || state.loadingOlder) {
      return;
    }

    setState({ loadingOlder: true, olderError: false });

    try {
      const page = await api.listMessages({ cursor, limit: pageSize });

      if (disposed) {
        return;
      }

      cursor = page.nextCursor;
      absorb(sortNewestFirst(page.messages), {
        tie: "older",
        live: false,
        patch: { loadingOlder: false, hasOlder: page.nextCursor !== null }
      });
    } catch (error) {
      if (disposed) {
        return;
      }

      const reason = unavailableReasonOf(error);
      if (reason) {
        setState({ loadingOlder: false });
        markUnavailable(reason);
        return;
      }

      if (errorCodeOf(error) === "invalid_cursor") {
        // Cursor que el backend ya no acepta: volvemos a paginar desde la página más reciente.
        cursor = null;
        setState({ loadingOlder: false });
        try {
          const page = await api.listMessages({ limit: pageSize });
          if (disposed) {
            return;
          }
          cursor = page.nextCursor;
          absorb(sortNewestFirst(page.messages), {
            tie: "newer",
            live: false,
            patch: { hasOlder: page.nextCursor !== null }
          });
        } catch {
          setState({ olderError: true });
        }
        return;
      }

      setState({ loadingOlder: false, olderError: true });
    }
  }

  // ── Tiempo real ───────────────────────────────────────────────────────

  /**
   * Abre (o reabre) el socket. `force`: reconecta ya aunque Phoenix esté esperando su backoff
   * (su `connect()` no hace nada mientras conserve la conexión caída).
   */
  async function connect({ force = false }: { force?: boolean } = {}) {
    if (!socketUrl || disposed || paused || state.status === "unavailable" || connectInFlight) {
      return;
    }

    if (socket?.isConnected()) {
      return;
    }

    connectInFlight = true;
    setState({ connection: "connecting" });

    try {
      if (token === null) {
        token = await getSocketToken({ fresh: false });
      }
    } catch {
      // Sin token no hay tiempo real; REST sigue funcionando (enviar cae a REST).
      connectInFlight = false;
      setState({ connection: "offline" });
      return;
    }

    connectInFlight = false;

    // `state` puede haber cambiado durante el await (TS no lo ve): se relee con una función.
    if (disposed || paused || currentStatus() === "unavailable") {
      return;
    }

    if (!socket) {
      createSocket(socketUrl);
      socket!.connect();
      return;
    }

    const current = socket;

    if (force) {
      current.disconnect(() => {
        if (!disposed && !paused && socket === current) {
          current.connect();
        }
      });
    } else {
      current.connect();
    }
  }

  function createSocket(url: string) {
    const instance = new SocketImpl(url, {
      params: () => ({ token: token ?? "" }),
      reconnectAfterMs: (tries: number) => [250, 1_000, 2_000, 4_000][tries - 1] ?? 8_000,
      rejoinAfterMs: (tries: number) => [1_000, 2_000, 5_000][tries - 1] ?? 10_000
    });

    instance.onError(() => {
      if (disposed || paused) {
        return;
      }
      channelJoined = false;
      setState({ connection: "connecting" });
      refreshSocketToken();
    });

    instance.onClose(() => {
      if (disposed) {
        return;
      }
      channelJoined = false;
      setState({ connection: paused || state.status === "unavailable" ? "offline" : "connecting" });
    });

    const topic = instance.channel(`chat:${conversationId}`, {});

    topic.on("new_message", (payload: ChatMessage) => {
      if (!disposed && payload && typeof payload.id === "string") {
        absorb([payload], { tie: "newer", live: true });
      }
    });

    topic.on("typing", (payload: ChatTypingEvent) => handleTyping(payload));

    topic.onError(() => {
      channelJoined = false;
      if (!disposed && !paused && state.status !== "unavailable") {
        setState({ connection: "connecting" });
      }
    });

    topic
      .join()
      .receive("ok", () => {
        if (disposed) {
          return;
        }
        channelJoined = true;
        setState({ connection: "live" });
        // Cada (re)unión: backfill para cubrir lo que pasó mientras no escuchábamos.
        void backfill();
      })
      .receive("error", (response?: { reason?: string }) => {
        const reason = response?.reason;
        if (reason && UNAVAILABLE_REASONS.has(reason)) {
          markUnavailable(reason);
        }
        // Otros errores: Phoenix reintenta la unión por su cuenta.
      });

    socket = instance;
    channel = topic;
  }

  function refreshSocketToken() {
    if (tokenRefreshInFlight || now() - lastTokenRefreshAt < TOKEN_REFRESH_MIN_INTERVAL_MS) {
      return;
    }

    lastTokenRefreshAt = now();
    tokenRefreshInFlight = getSocketToken({ fresh: true })
      .then((fresh) => {
        token = fresh;
      })
      .catch((error) => {
        if (isAuthFatal(error)) {
          // Sesión caducada del todo: dejamos de insistir (la app vuelve al login).
          teardownSocket();
          setState({ connection: "offline" });
        }
      })
      .finally(() => {
        tokenRefreshInFlight = null;
      });
  }

  function teardownSocket() {
    channelJoined = false;
    const current = socket;
    const currentChannel = channel;
    socket = null;
    channel = null;

    try {
      currentChannel?.leave();
    } catch {
      // Ignorado: el canal puede no haberse unido nunca.
    }

    current?.disconnect();
  }

  function handleTyping(payload: ChatTypingEvent) {
    if (disposed || !payload) {
      return;
    }

    if (state.myProfileId !== null && payload.profileId === state.myProfileId) {
      return;
    }

    if (state.otherProfileId !== null && payload.profileId !== state.otherProfileId) {
      return;
    }

    clearTypingTimer();
    typingTimer = setTimeout(() => {
      typingTimer = null;
      setState({ otherTyping: false });
    }, TYPING_TTL_MS);

    if (!state.otherTyping) {
      setState({ otherTyping: true });
    }
  }

  function clearTypingTimer() {
    if (typingTimer !== null) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  function markUnavailable(reason: string) {
    if (disposed) {
      return;
    }

    retryTimers.forEach((timer) => clearTimeout(timer));
    retryTimers.clear();
    clearTypingTimer();
    teardownSocket();

    const wasUnavailable = state.status === "unavailable";
    setState({
      status: "unavailable",
      unavailableReason: reason,
      connection: "offline",
      otherTyping: false,
      loadingOlder: false,
      outbox: state.outbox.map((item) => ({ ...item, status: "failed", retryable: false }))
    });

    if (!wasUnavailable) {
      events.onUnavailable?.(reason);
    }
  }

  // ── Leído ─────────────────────────────────────────────────────────────

  function scheduleMarkRead(delay = MARK_READ_DEBOUNCE_MS) {
    if (!readPending || !visible || disposed || state.status !== "ready") {
      return;
    }

    if (markReadTimer !== null) {
      clearTimeout(markReadTimer);
    }

    markReadTimer = setTimeout(() => {
      markReadTimer = null;
      void flushMarkRead();
    }, delay);
  }

  async function flushMarkRead() {
    if (!readPending || !visible || disposed || markReadInFlight || state.status !== "ready") {
      return;
    }

    markReadInFlight = true;
    readPending = false;

    try {
      await api.markRead();
      if (!disposed) {
        events.onRead?.();
      }
    } catch (error) {
      readPending = true;
      const reason = unavailableReasonOf(error);
      if (reason) {
        markUnavailable(reason);
      }
    } finally {
      markReadInFlight = false;
      // Si llegó algo mientras marcábamos, otra pasada.
      if (readPending) {
        scheduleMarkRead();
      }
    }
  }

  // ── Envío ─────────────────────────────────────────────────────────────

  function send(body: string): OutgoingMessage | null {
    const validation = validateMessageBody(body);

    if (!validation.ok || disposed || state.status === "unavailable") {
      return null;
    }

    const item: OutgoingMessage = {
      clientId: createClientId(),
      conversationId,
      body: validation.body,
      createdAt: new Date(now()).toISOString(),
      status: "sending",
      attempts: 0,
      ambiguous: false,
      retryable: true
    };

    setState({ outbox: [...state.outbox, item], liveKeys: withLiveKeys([item.clientId]) });
    void deliver(item.clientId);
    return item;
  }

  async function deliver(clientId: string) {
    clearRetryTimer(clientId);
    let item = findOutgoing(clientId);

    if (!item || disposed) {
      return;
    }

    if (item.ambiguous) {
      // El intento anterior pudo llegar: miramos el historial antes de reenviar.
      updateOutgoing(clientId, { status: "sending" });
      await backfill();
      item = findOutgoing(clientId);
      if (!item || disposed) {
        return;
      }
    }

    const attempts = item.attempts + 1;
    updateOutgoing(clientId, { status: "sending", attempts, ambiguous: false });

    const result = await transmit(item.body);

    if (disposed) {
      return;
    }

    switch (result.kind) {
      case "ok":
        confirmDelivery(clientId, result.message);
        return;
      case "unavailable":
        markUnavailable(result.reason);
        return;
      case "invalid":
        if (findOutgoing(clientId)) {
          updateOutgoing(clientId, { status: "failed", retryable: false });
        }
        return;
      case "transient": {
        if (!findOutgoing(clientId)) {
          return; // Ya reconciliado por el eco del canal o un backfill.
        }

        if (attempts < MAX_AUTO_ATTEMPTS) {
          updateOutgoing(clientId, { ambiguous: result.ambiguous });
          retryTimers.set(
            clientId,
            setTimeout(() => {
              retryTimers.delete(clientId);
              void deliver(clientId);
            }, AUTO_RETRY_DELAY_MS)
          );
          return;
        }

        updateOutgoing(clientId, { status: "failed", ambiguous: result.ambiguous, retryable: true });
      }
    }
  }

  function transmit(body: string): Promise<TransmitResult> {
    if (channel && channelJoined && socket?.isConnected()) {
      const topic = channel;
      return new Promise<TransmitResult>((resolve) => {
        topic
          .push("send_message", { body }, PUSH_TIMEOUT_MS)
          .receive("ok", (response?: { message?: ChatMessage }) => {
            resolve(
              response?.message ? { kind: "ok", message: response.message } : { kind: "transient", ambiguous: true }
            );
          })
          .receive("error", (response?: { reason?: string; errors?: unknown }) => {
            resolve(classifyChannelError(response));
          })
          .receive("timeout", () => resolve({ kind: "transient", ambiguous: true }));
      });
    }

    return api.sendMessage(body).then(
      (message): TransmitResult => ({ kind: "ok", message }),
      (error): TransmitResult => classifyRestError(error)
    );
  }

  function confirmDelivery(clientId: string, message: ChatMessage) {
    const aliases = new Map<string, string>();
    if (!state.keyAliases.has(message.id)) {
      aliases.set(clientId, message.id);
    }

    const merged = mergeMessages(state.messages, [message], "newer");
    readPending = false; // El backend marca como leído al enviar.
    setState({
      myProfileId: state.myProfileId ?? message.senderProfileId,
      messages: merged.messages,
      outbox: state.outbox.filter((item) => item.clientId !== clientId),
      keyAliases: withAliases(aliases)
    });
    events.onRead?.();
  }

  function retry(clientId: string) {
    const item = findOutgoing(clientId);

    if (!item || !item.retryable || item.status === "sending" || disposed) {
      return;
    }

    updateOutgoing(clientId, { status: "sending", attempts: 0 });
    void deliver(clientId);
  }

  function discard(clientId: string) {
    const item = findOutgoing(clientId);

    if (!item || item.status === "sending") {
      return;
    }

    clearRetryTimer(clientId);
    setState({ outbox: state.outbox.filter((entry) => entry.clientId !== clientId) });
  }

  function clearRetryTimer(clientId: string) {
    const timer = retryTimers.get(clientId);
    if (timer !== undefined) {
      clearTimeout(timer);
      retryTimers.delete(clientId);
    }
  }

  function notifyTyping() {
    if (!channel || !channelJoined || disposed || now() - lastTypingSentAt < TYPING_THROTTLE_MS) {
      return;
    }

    lastTypingSentAt = now();
    try {
      channel.push("typing", {}, 5_000);
    } catch {
      // `typing` es opcional: nunca rompe el chat.
    }
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start() {
      if (started || disposed) {
        return;
      }
      started = true;
      void loadInitial();
    },

    retryLoad() {
      if (state.status === "error") {
        void loadInitial();
      }
    },

    loadOlder,
    send,
    retry,
    discard,
    notifyTyping,

    setVisible(next) {
      visible = next;
      if (next) {
        scheduleMarkRead(0);
      } else if (markReadTimer !== null) {
        clearTimeout(markReadTimer);
        markReadTimer = null;
      }
    },

    setOtherProfileId(profileId) {
      if (profileId === state.otherProfileId) {
        return;
      }
      setState({ otherProfileId: profileId, ...(profileId ? learnIdentityFor(profileId) : {}) });
    },

    pause() {
      if (disposed || paused) {
        return;
      }
      paused = true;
      clearTypingTimer();
      channelJoined = false;
      socket?.disconnect();
      setState({ connection: "offline", otherTyping: false });
    },

    resume() {
      if (disposed) {
        return;
      }

      const wasPaused = paused;
      paused = false;

      if (state.status === "error") {
        void loadInitial();
        return;
      }

      if (state.status !== "ready") {
        return;
      }

      // Primero REST (refresca el token si caducó en segundo plano), luego el socket.
      void backfill().then(() => {
        if (disposed || paused || state.status !== "ready") {
          return;
        }
        if (!socket) {
          void connect();
        } else if (wasPaused || !socket.isConnected()) {
          void connect({ force: !wasPaused });
        }
      });
      scheduleMarkRead(0);
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      if (markReadTimer !== null) {
        clearTimeout(markReadTimer);
        markReadTimer = null;
      }
      clearTypingTimer();
      retryTimers.forEach((timer) => clearTimeout(timer));
      retryTimers.clear();
      teardownSocket();
      listeners.clear();
    }
  };

  function learnIdentityFor(otherProfileId: string): Partial<ChatSessionState> {
    if (state.myProfileId !== null) {
      return {};
    }

    const mine = state.messages.find((message) => message.senderProfileId !== otherProfileId);
    return mine ? { myProfileId: mine.senderProfileId } : {};
  }
}

// ── Clasificación de errores ─────────────────────────────────────────────

function errorCodeOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

function unavailableReasonOf(error: unknown): string | null {
  const code = errorCodeOf(error);

  if (code !== null && UNAVAILABLE_REASONS.has(code)) {
    return code;
  }

  // 403 sin código reconocible en una conversación = ya no es tuya.
  return statusOf(error) === 403 ? "conversation_not_active" : null;
}

function isAuthFatal(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === "session_refresh_failed" || error.message === "missing_session";
  }

  return false;
}

export function classifyRestError(error: unknown): TransmitResult {
  const reason = unavailableReasonOf(error);
  if (reason) {
    return { kind: "unavailable", reason };
  }

  const status = statusOf(error);

  if (status === 422) {
    return { kind: "invalid" };
  }

  if (status === 429) {
    return { kind: "transient", ambiguous: false };
  }

  // Red caída a mitad (sin status) o 5xx: pudo guardarse antes de fallar.
  return { kind: "transient", ambiguous: status === undefined || status === 0 || status >= 500 };
}

function classifyChannelError(response?: { reason?: string; errors?: unknown }): TransmitResult {
  if (response?.reason && UNAVAILABLE_REASONS.has(response.reason)) {
    return { kind: "unavailable", reason: response.reason };
  }

  if (response?.errors) {
    return { kind: "invalid" };
  }

  // El servidor contestó con error: no se guardó.
  return { kind: "transient", ambiguous: false };
}
