/**
 * react-native-gesture-handler mock for jsdom tests: detectors render their
 * children and gesture builders are inert chainables.
 */
import { createElement as h, type PropsWithChildren } from "react";

function chain(): any {
  const target: any = new Proxy(() => target, { get: (_t, key) => (key === "then" ? undefined : () => target) });
  return target;
}

export const Gesture = {
  Pan: chain,
  Tap: chain,
  LongPress: chain,
  Fling: chain,
  Pinch: chain,
  Rotation: chain,
  Native: chain,
  Manual: chain,
  Hover: chain,
  Simultaneous: chain,
  Exclusive: chain,
  Race: chain
};

export function GestureDetector({ children }: PropsWithChildren<{ gesture?: unknown }>) {
  return <>{children}</>;
}

export function GestureHandlerRootView({ children, style }: PropsWithChildren<{ style?: unknown }>) {
  return h("div", { "data-testid": "gesture-root", style }, children);
}

export const State = { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 };
export const Directions = { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 };
