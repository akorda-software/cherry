/**
 * React Native mock for jsdom-based vitest tests.
 * Maps RN primitives to HTML elements with proper ARIA prop translation.
 */
import { createElement as h, forwardRef } from "react";

/** Map RN accessibility props to HTML equivalents */
function mapRnPropsToProps(props: Record<string, any>) {
  const {
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityLiveRegion,
    "aria-level": ariaLevel,
    ...rest
  } = props;

  const mapped: Record<string, any> = { ...rest };

  if (testID !== undefined) {
    mapped["data-testid"] = testID;
    delete mapped.testID;
  }
  if (accessibilityLabel !== undefined) {
    mapped["aria-label"] = accessibilityLabel;
    delete mapped.accessibilityLabel;
  }
  if (accessibilityRole !== undefined) {
    mapped["role"] = accessibilityRole;
    delete mapped.accessibilityRole;
  }
  // Native `role` prop passes through directly to HTML role attribute
  // (already in rest, no mapping needed)

  if (accessibilityLiveRegion !== undefined) {
    mapped["aria-live"] = accessibilityLiveRegion;
    delete mapped.accessibilityLiveRegion;
  }

  return mapped;
}

function createComponent(tag: string, displayName: string) {
  const Comp = forwardRef<any, any>((props, ref) => {
    const { style, ...rest } = props;
    const flatStyle = flattenStyle(style);
    const htmlProps = mapRnPropsToProps(rest);
    return h(tag, { ...htmlProps, style: flatStyle, ref });
  });
  Comp.displayName = displayName;
  return Comp;
}

function flattenStyle(style: any): Record<string, any> | undefined {
  if (!style) return undefined;
  if (typeof style === "function") return flattenStyle(style({ pressed: false }));
  if (Array.isArray(style)) {
    const result: Record<string, any> = {};
    for (const s of style) {
      const flat = flattenStyle(s);
      if (flat) Object.assign(result, flat);
    }
    return result;
  }
  return style;
}

export const View = createComponent("div", "View");
export const Text = createComponent("span", "Text");
export const ScrollView = createComponent("div", "ScrollView");

export const Pressable = forwardRef<any, any>((props, ref) => {
  const { style, onPress, disabled, children, ...rest } = props;
  // Handle RN Pressable style: can be object, array, or function returning object/array
  let resolvedStyle: any;
  if (typeof style === "function") {
    const result = style({ pressed: false });
    resolvedStyle = flattenStyle(result);
  } else {
    resolvedStyle = flattenStyle(style);
  }
  const htmlProps = mapRnPropsToProps(rest);
  return h("button", {
    ...htmlProps,
    disabled,
    onClick: onPress,
    style: resolvedStyle,
    ref,
    children,
  });
});
Pressable.displayName = "Pressable";

export const ActivityIndicator = forwardRef<any, any>((props, ref) => {
  const { style, ...rest } = props;
  const htmlProps = mapRnPropsToProps(rest);
  return h("div", { ...htmlProps, style, ref });
});
ActivityIndicator.displayName = "ActivityIndicator";

export const StyleSheet = {
  create(styles: Record<string, any>) {
    return styles;
  },
  flatten(style: any) {
    if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
    return style;
  },
};

export const Platform = { OS: "web" as const };
