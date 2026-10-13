/**
 * react-native-reanimated mock for jsdom tests.
 * Animations resolve instantly to their target value; animated components are
 * the plain react-native mocks. Enough for render/smoke tests, not for timing.
 */
import { createElement as h, forwardRef, useRef, type ComponentType } from "react";
import { ScrollView, Text, View } from "react-native";

type AnyProps = Record<string, any>;

function flatten(style: any): AnyProps | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten).filter(Boolean));
  return style;
}

export function createAnimatedComponent<P extends object>(Component: ComponentType<P>) {
  const Animated = forwardRef<any, AnyProps>(({ style, animatedProps, entering, exiting, layout, ...rest }, ref) =>
    h(Component as ComponentType<any>, { ...rest, ...(animatedProps ?? {}), style: flatten(style), ref })
  );
  Animated.displayName = `Animated(${(Component as { displayName?: string }).displayName ?? "Component"})`;
  return Animated;
}

const AnimatedView = createAnimatedComponent(View as ComponentType<any>);
const AnimatedText = createAnimatedComponent(Text as ComponentType<any>);
const AnimatedImage = createAnimatedComponent(View as ComponentType<any>);
const AnimatedScrollView = createAnimatedComponent(ScrollView as ComponentType<any>);

export function useSharedValue<T>(initial: T) {
  const ref = useRef<{ value: T; get(): T; set(v: T): void } | null>(null);
  if (!ref.current) {
    const box = {
      value: initial,
      get: () => box.value,
      set: (v: T) => {
        box.value = v;
      }
    };
    ref.current = box;
  }
  return ref.current;
}

export const useAnimatedStyle = (fn: () => AnyProps) => fn();
export const useAnimatedProps = (fn: () => AnyProps) => fn();
export const useDerivedValue = <T,>(fn: () => T) => ({ value: fn(), get: () => fn() });
export const useAnimatedReaction = () => undefined;
export const useAnimatedRef = () => ({ current: null });
export const useAnimatedScrollHandler = () => () => undefined;
export const useFrameCallback = () => ({ setActive: () => undefined, isActive: false });
export const useReducedMotion = () => false;
export const useScrollOffset = () => ({ value: 0 });

export const withTiming = <T,>(value: T, _config?: unknown, callback?: (finished: boolean) => void) => {
  callback?.(true);
  return value;
};
export const withSpring = withTiming;
export const withDecay = (config: { velocity?: number }) => config.velocity ?? 0;
export const withDelay = <T,>(_delay: number, value: T) => value;
export const withSequence = <T,>(...values: T[]) => values[values.length - 1];
export const withRepeat = <T,>(value: T) => value;
export const withClamp = <T,>(_config: unknown, value: T) => value;
export const cancelAnimation = () => undefined;

export const runOnJS =
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  (...args: A) =>
    fn(...args);
export const runOnUI = runOnJS;
export const scheduleOnRN = <A extends unknown[], R>(fn: (...args: A) => R, ...args: A) => fn(...args);
export const scheduleOnUI = scheduleOnRN;
export const measure = () => null;
export const scrollTo = () => undefined;

export const Extrapolation = { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" } as const;
export const ReduceMotion = { System: "system", Always: "always", Never: "never" } as const;

export function interpolate(value: number, input: number[], output: number[]) {
  if (value <= input[0]) return output[0];
  for (let i = 1; i < input.length; i++) {
    if (value <= input[i]) {
      const t = (value - input[i - 1]) / (input[i] - input[i - 1] || 1);
      return output[i - 1] + (output[i] - output[i - 1]) * t;
    }
  }
  return output[output.length - 1];
}

export const interpolateColor = (_value: number, _input: number[], output: string[]) => output[0];

const identityEasing = (t: number) => t;
export const Easing = {
  linear: identityEasing,
  ease: identityEasing,
  quad: identityEasing,
  cubic: identityEasing,
  sin: identityEasing,
  circle: identityEasing,
  exp: identityEasing,
  bounce: identityEasing,
  back: () => identityEasing,
  elastic: () => identityEasing,
  bezier: () => identityEasing,
  bezierFn: () => identityEasing,
  in: (e: (t: number) => number) => e,
  out: (e: (t: number) => number) => e,
  inOut: (e: (t: number) => number) => e
};

/** Builders de layout animations (FadeIn.duration(200).delay(50)…): encadenables e inertes. */
function layoutBuilder(): any {
  const target: any = new Proxy(() => target, { get: (_t, key) => (key === "then" ? undefined : () => target) });
  return target;
}
export const FadeIn = layoutBuilder();
export const FadeOut = layoutBuilder();
export const FadeInDown = layoutBuilder();
export const FadeInUp = layoutBuilder();
export const FadeOutDown = layoutBuilder();
export const FadeOutUp = layoutBuilder();
export const ZoomIn = layoutBuilder();
export const ZoomOut = layoutBuilder();
export const SlideInDown = layoutBuilder();
export const SlideOutDown = layoutBuilder();
export const SlideInRight = layoutBuilder();
export const SlideOutLeft = layoutBuilder();
export const LinearTransition = layoutBuilder();
export const Layout = layoutBuilder();

const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  Image: AnimatedImage,
  ScrollView: AnimatedScrollView,
  createAnimatedComponent
};

export default Animated;
