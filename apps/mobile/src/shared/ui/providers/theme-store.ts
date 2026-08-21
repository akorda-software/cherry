import { create } from "zustand";

import { lightTheme } from "../themes/light-theme";
import type { AppTheme } from "../themes/theme-types";

interface ThemeState {
  theme: AppTheme;
  setTheme(theme: AppTheme): void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: lightTheme,
  setTheme: (theme) => set({ theme })
}));

export function useTheme(): AppTheme {
  return useThemeStore((s) => s.theme);
}
