import type { AppTheme } from "../themes/theme-types";

export function createContentWidth(theme: AppTheme) {
  return {
    maxWidth: theme.semantic.layout.contentMaxWidth,
    width: "100%" as const,
    alignSelf: "center" as const,
  };
}

export function createInteractiveState(theme: AppTheme, disabled?: boolean) {
  return disabled
    ? {
        opacity: theme.primitives.opacity.disabled,
      }
    : {};
}
