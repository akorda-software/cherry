import type { PropsWithChildren } from "react";

function NavigationScreen({ children }: PropsWithChildren<{ name: string }>) {
  return <>{children ?? null}</>;
}

export const Drawer = Object.assign(
  function Drawer({ children }: PropsWithChildren) {
    return <div data-testid="drawer-navigation">{children}</div>;
  },
  { Screen: NavigationScreen }
);
