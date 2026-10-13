import { createElement as h, type PropsWithChildren } from "react";

/** expo-linear-gradient mock: a plain container. */
export function LinearGradient({ children, testID }: PropsWithChildren<{ testID?: string; colors?: unknown; style?: unknown }>) {
  return h("div", { "data-testid": testID ?? "linear-gradient" }, children);
}
