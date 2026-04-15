import type { PropsWithChildren } from "react";
import { Slot } from "expo-router";

export function PublicLayout({ children }: PropsWithChildren) {
  return <>{children ?? <Slot />}</>;
}

export default function PublicLayoutRoute() {
  return <PublicLayout />;
}
