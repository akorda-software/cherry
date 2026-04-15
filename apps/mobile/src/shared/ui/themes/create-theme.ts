import { lightTheme } from "./light-theme";
import type { AppTheme, CreateThemeInput } from "./theme-types";

export function createTheme({ name, semantic }: CreateThemeInput): AppTheme {
  return {
    ...lightTheme,
    name,
    semantic: {
      ...lightTheme.semantic,
      color: { ...lightTheme.semantic.color, ...semantic?.color },
      text: { ...lightTheme.semantic.text, ...semantic?.text },
      icon: { ...lightTheme.semantic.icon, ...semantic?.icon },
      surface: { ...lightTheme.semantic.surface, ...semantic?.surface },
      border: { ...lightTheme.semantic.border, ...semantic?.border },
      action: { ...lightTheme.semantic.action, ...semantic?.action },
      state: { ...lightTheme.semantic.state, ...semantic?.state },
      layout: { ...lightTheme.semantic.layout, ...semantic?.layout }
    }
  };
}
