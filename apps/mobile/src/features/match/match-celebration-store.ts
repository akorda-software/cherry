import { create } from "zustand";

import type { DiscoveryMatch } from "@snack/contracts";

interface MatchCelebrationState {
  /** Match que se está celebrando ahora mismo (null = nada en pantalla). */
  match: DiscoveryMatch | null;
  /** Lanza la celebración: cualquier pantalla que cree un match (swipe, feed, perfil, likes). */
  show(match: DiscoveryMatch): void;
  dismiss(): void;
}

export const useMatchCelebrationStore = create<MatchCelebrationState>((set) => ({
  match: null,
  show: (match) => set({ match }),
  dismiss: () => set({ match: null })
}));
