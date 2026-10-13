import { create } from "zustand";

export interface TabBadges {
  /** Personas que te han dado like y aún no has visto. */
  likes: number;
  /** Conversaciones con mensajes sin leer. */
  chats: number;
}

interface TabBadgesState extends TabBadges {
  set(partial: Partial<TabBadges>): void;
}

/** Contadores de la barra de pestañas: `useTabBadgesStore.getState().set({ chats: 2 })`. */
export const useTabBadgesStore = create<TabBadgesState>((set) => ({
  likes: 0,
  chats: 0,
  set: (partial) => set(partial)
}));
