import { type PropsWithChildren, useEffect } from "react";

import { useThemeStore } from "./theme-store";
import type { AppTheme } from "../themes/theme-types";

export { useTheme } from "./theme-store";

export function ThemeProvider({
  children,
  theme
}: PropsWithChildren<{ theme?: AppTheme }>) {
  useEffect(() => {
    if (theme) {
      useThemeStore.getState().setTheme(theme);
    }
  }, [theme]);

  return <>{children}</>;
}
