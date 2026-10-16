import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

import type { ChatMessage } from "@cherry/contracts";
import { createActivityApi, createChatApi } from "@cherry/mobile-shared";

import { createJsonHttpClient } from "../../../shared/api";
import { useRuntimeConfig } from "../../../shared/config";
import { refreshActivitySummary } from "../../activity/application/activity-poller";
import { useActivityStore } from "../../activity/application/activity-store";
import { useAuthedApi, useSessionShell } from "../../auth/presentation";
import { useMatchesStore } from "../../matches/application/matches-store";
import { buildTimeline, type TimelineItem } from "../domain/timeline";
import { currentWebOrigin, socketUrlFromApiBase } from "../infrastructure/socket-url";
import { createChatSession, type ChatSession, type ChatSessionState } from "./chat-session";

const IDLE_STATE: ChatSessionState = {
  conversationId: "",
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
  otherProfileId: null
};

const noopSubscribe = () => () => undefined;
const getIdleState = () => IDLE_STATE;

export interface UseChatSessionOptions {
  /** Perfil de la otra persona (del match). Se puede conocer más tarde. */
  otherProfileId: string | null;
  /** La pantalla está enfocada (la app en primer plano lo comprueba el propio hook). */
  focused: boolean;
}

export interface ChatSessionController {
  state: ChatSessionState;
  timeline: TimelineItem[];
  send(body: string): boolean;
  retry(clientId: string): void;
  discard(clientId: string): void;
  loadOlder(): void;
  retryLoad(): void;
  notifyTyping(): void;
}

/**
 * Conversación en tiempo real para una pantalla: crea la sesión (REST + canal Phoenix),
 * la conecta al ciclo de vida (foco, primer plano) y mantiene al día la lista de chats y los
 * badges.
 */
export function useChatSession(
  conversationId: string,
  { otherProfileId, focused }: UseChatSessionOptions
): ChatSessionController {
  const callChatApi = useAuthedApi(createChatApi);
  const { executeAuthenticated } = useSessionShell();
  const { apiBaseUrl } = useRuntimeConfig();
  const [appActive, setAppActive] = useState(() => (AppState?.currentState ?? "active") === "active");
  const visible = focused && appActive;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const otherProfileIdRef = useRef(otherProfileId);
  otherProfileIdRef.current = otherProfileId;
  // Por ref: un cambio de identidad de estas funciones nunca debe tirar el socket.
  const callChatApiRef = useRef(callChatApi);
  callChatApiRef.current = callChatApi;
  const executeAuthenticatedRef = useRef(executeAuthenticated);
  executeAuthenticatedRef.current = executeAuthenticated;

  const socketUrl = useMemo(
    () => socketUrlFromApiBase(apiBaseUrl, Platform.OS === "web" ? currentWebOrigin() : null),
    [apiBaseUrl]
  );

  const [session, setSession] = useState<ChatSession | null>(null);

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    let active = true;
    const created = createChatSession({
      conversationId,
      socketUrl,
      otherProfileId: otherProfileIdRef.current,
      api: {
        listMessages: (query) => callChatApiRef.current((api) => api.listMessages(conversationId, query)),
        sendMessage: (body) => callChatApiRef.current((api) => api.sendMessage(conversationId, body)),
        markRead: () => callChatApiRef.current((api) => api.markRead(conversationId))
      },
      async getSocketToken({ fresh }) {
        if (!fresh) return executeAuthenticatedRef.current(async (token) => token);

        // Validate/refresh credentials, but publish only AFTER the auth boundary checks ownership.
        const result = await executeAuthenticatedRef.current(async (token) => ({
          token,
          summary: await createActivityApi(
            createJsonHttpClient({ apiBaseUrl, getHeaders: () => ({ Authorization: `Bearer ${token}` }) })
          ).getSummary()
        }));
        if (active) useActivityStore.getState().setSummary(result.summary);
        return result.token;
      },
      events: {
        onLatestMessage(message: ChatMessage, mine: boolean) {
          useMatchesStore.getState().applyMessage(conversationId, message, { read: mine || visibleRef.current });
        },
        onRead() {
          const matches = useMatchesStore.getState();
          const match = matches.matches.find((candidate) => candidate.conversationId === conversationId);
          if (match && match.unreadCount > 0) {
            useActivityStore.getState().adjust({ unreadConversationsCount: -1 });
          }
          matches.markRead(conversationId);
          // El badge ya se ajustó en local: basta un refresco agrupado (sin `force`), no uno por lectura.
          void refreshActivitySummary();
        },
        onUnavailable() {
          const match = useMatchesStore
            .getState()
            .matches.find((candidate) => candidate.conversationId === conversationId);
          if (match) {
            useMatchesStore.getState().removeMatch(match.id);
          }
          void refreshActivitySummary({ force: true });
        }
      }
    });

    setSession(created);
    created.start();

    return () => {
      active = false;
      created.dispose();
      setSession((current) => (current === created ? null : current));
    };
  }, [apiBaseUrl, conversationId, socketUrl]);

  // Primer plano / segundo plano.
  useEffect(() => {
    if (!session || !AppState?.addEventListener) {
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (next) => {
      const active = next === "active";
      setAppActive(active);
      if (active) {
        session.resume();
      } else if (next === "background") {
        session.pause();
      }
    });

    return () => subscription?.remove();
  }, [session]);

  useEffect(() => {
    session?.setVisible(visible);
  }, [session, visible]);

  useEffect(() => {
    session?.setOtherProfileId(otherProfileId);
  }, [otherProfileId, session]);

  const state = useSyncExternalStore(
    session ? session.subscribe : noopSubscribe,
    session ? session.getState : getIdleState,
    session ? session.getState : getIdleState
  );

  const timeline = useMemo(() => {
    const mineOf = (message: ChatMessage) =>
      state.myProfileId !== null
        ? message.senderProfileId === state.myProfileId
        : state.otherProfileId !== null
          ? message.senderProfileId !== state.otherProfileId
          : false;

    return buildTimeline(state.messages, state.outbox, { isMine: mineOf, keyAliases: state.keyAliases });
  }, [state.keyAliases, state.messages, state.myProfileId, state.otherProfileId, state.outbox]);

  return {
    state,
    timeline,
    send: useCallback((body: string) => session?.send(body) != null, [session]),
    retry: useCallback((clientId: string) => session?.retry(clientId), [session]),
    discard: useCallback((clientId: string) => session?.discard(clientId), [session]),
    loadOlder: useCallback(() => void session?.loadOlder(), [session]),
    retryLoad: useCallback(() => session?.retryLoad(), [session]),
    notifyTyping: useCallback(() => session?.notifyTyping(), [session])
  };
}
