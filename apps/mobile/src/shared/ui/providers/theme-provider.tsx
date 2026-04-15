import { createContext, type PropsWithChildren, useContext } from "react";

import { lightTheme } from "../themes/light-theme";
import type { AppTheme } from "../themes/theme-types";

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({ children, theme = lightTheme }: PropsWithChildren<{ theme?: AppTheme }>) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
