import { create } from "zustand";

import type { DiscoveryMatch } from "@snack/contracts";

interface MatchCelebrationState {
  /** Match que se está celebrando ahora mismo (null = nada en pantalla). */
  match: DiscoveryMatch | null;
  /** Matches que esperan su turno (si llegan dos seguidos, se celebran uno detrás de otro). */
  queue: DiscoveryMatch[];
  /** Lanza la celebración: cualquier pantalla que cree un match (swipe, feed, perfil, likes). */
  show(match: DiscoveryMatch): void;
  /** Cierra la celebración actual (y pasa a la siguiente si la hay). */
  dismiss(): void;
}

export const useMatchCelebrationStore = create<MatchCelebrationState>((set, get) => ({
  match: null,
  queue: [],
  show: (match) => {
    const { match: current, queue } = get();

    if (current?.id === match.id || queue.some((queued) => queued.id === match.id)) {
      return;
    }

    if (current === null) {
      set({ match });
    } else {
      set({ queue: [...queue, match] });
    }
  },
  dismiss: () => {
    const [next = null, ...rest] = get().queue;
    set({ match: next, queue: rest });
  }
}));
