import { create } from "zustand";

import type { ActivitySummary } from "@cherry/contracts";

import { useTabBadgesStore } from "../../../shared/ui/app-shell/tab-badges-store";
import { onSignOut } from "../../auth/presentation/on-sign-out";

/**
 * Contadores de actividad para los badges de las pestañas (`GET /api/me/summary`).
 * El servidor manda; las pantallas pueden ajustar en optimista (`adjust`) para que el badge
 * reaccione al instante (responder un like, abrir un chat) hasta la siguiente consulta.
 */

export interface ActivityState {
  summary: ActivitySummary | null;
  lastFetchedAt: number | null;
  setSummary(summary: ActivitySummary): void;
  /** Suma deltas a los contadores (nunca por debajo de 0). Sin datos aún, no hace nada. */
  adjust(delta: Partial<ActivitySummary>): void;
  reset(): void;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  summary: null,
  lastFetchedAt: null,

  setSummary(summary) {
    const current = get().summary;
    if (
      current &&
      current.receivedLikesCount === summary.receivedLikesCount &&
      current.newMatchesCount === summary.newMatchesCount &&
      current.unreadConversationsCount === summary.unreadConversationsCount
    ) {
      set({ lastFetchedAt: Date.now() });
      return;
    }

    set({ summary: { ...summary }, lastFetchedAt: Date.now() });
  },

  adjust(delta) {
    const current = get().summary;
    if (!current) {
      return;
    }

    const next: ActivitySummary = {
      receivedLikesCount: Math.max(0, current.receivedLikesCount + (delta.receivedLikesCount ?? 0)),
      newMatchesCount: Math.max(0, current.newMatchesCount + (delta.newMatchesCount ?? 0)),
      unreadConversationsCount: Math.max(0, current.unreadConversationsCount + (delta.unreadConversationsCount ?? 0))
    };

    set({ summary: next });
  },

  reset() {
    set({ summary: null, lastFetchedAt: null });
  }
}));

/** Badge de la pestaña Likes. */
export function likesBadgeCount(summary: ActivitySummary | null): number {
  return summary?.receivedLikesCount ?? 0;
}

/** Badge de la pestaña Chats: conversaciones sin leer + matches nuevos sin abrir. */
export function chatsBadgeCount(summary: ActivitySummary | null): number {
  return summary ? summary.unreadConversationsCount + summary.newMatchesCount : 0;
}

onSignOut(() => useActivityStore.getState().reset());

// Los badges de la barra de pestañas siguen siempre a estos contadores (también al cerrar sesión → 0).
useActivityStore.subscribe((state, previous) => {
  if (state.summary !== previous.summary) {
    useTabBadgesStore.getState().set({
      likes: likesBadgeCount(state.summary),
      chats: chatsBadgeCount(state.summary)
    });
  }
});
