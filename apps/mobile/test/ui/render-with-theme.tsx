import type { PropsWithChildren, ReactElement } from "react";
import { render } from "@testing-library/react";

import { ThemeProvider } from "../../src/shared/ui";

function ThemeTestProvider({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

export function renderWithTheme(ui: ReactElement) {
  return render(ui, { wrapper: ThemeTestProvider });
}
