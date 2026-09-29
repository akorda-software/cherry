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
  if (accessibilityRole !== undefined && mapped["role"] === undefined) {
    // Como en RN, `role` manda sobre `accessibilityRole`; los roles propios de RN se traducen a ARIA.
    const ariaRoles: Record<string, string> = { header: "heading", adjustable: "slider", image: "img" };
    mapped["role"] = ariaRoles[accessibilityRole] ?? accessibilityRole;
  }
  delete mapped.accessibilityRole;
  // Native `role` prop passes through directly to HTML role attribute
  // (already in rest, no mapping needed)

  if (accessibilityLiveRegion !== undefined) {
    mapped["aria-live"] = accessibilityLiveRegion;
    delete mapped.accessibilityLiveRegion;
  }

  // accessibilityState → aria-* (disabled, selected, checked, busy, expanded)
  const state = mapped.accessibilityState as Record<string, unknown> | undefined;
  if (state) {
    for (const key of ["disabled", "selected", "checked", "busy", "expanded"]) {
      if (state[key] !== undefined && mapped[`aria-${key}`] === undefined) {
        mapped[`aria-${key}`] = state[key];
      }
    }
  }

  // Props solo de RN que el DOM no entiende (evita avisos de React en los tests).
  for (const key of RN_ONLY_PROPS) {
    delete mapped[key];
  }

  return mapped;
}

const RN_ONLY_PROPS = [
  "accessibilityState",
  "accessibilityHint",
  "accessibilityValue",
  "accessibilityActions",
  "onAccessibilityAction",
  "accessibilityElementsHidden",
  "accessibilityViewIsModal",
  "importantForAccessibility",
  "accessible",
  "onPressIn",
  "onPressOut",
  "onLongPress",
  "delayLongPress",
  "hitSlop",
  "android_ripple",
  "unstable_pressDelay",
  "onLayout",
  "numberOfLines",
  "adjustsFontSizeToFit",
  "minimumFontScale",
  "maxFontSizeMultiplier",
  "allowFontScaling",
  "selectable",
  "nativeID",
  "pointerEvents",
  "collapsable",
  "needsOffscreenAlphaCompositing",
  // ScrollView
  "bounces",
  "alwaysBounceVertical",
  "overScrollMode",
  "contentContainerStyle",
  "contentInsetAdjustmentBehavior",
  "keyboardShouldPersistTaps",
  "keyboardDismissMode",
  "showsVerticalScrollIndicator",
  "showsHorizontalScrollIndicator",
  "refreshControl",
  "horizontal",
  "nestedScrollEnabled",
  "scrollEventThrottle",
  "stickyHeaderIndices",
  "pagingEnabled",
  "snapToInterval",
  "decelerationRate",
  "onMomentumScrollEnd",
  "onScrollBeginDrag",
  "onScrollEndDrag",
  "automaticallyAdjustKeyboardInsets",
  // Modal
  "animationType",
  "transparent",
  "statusBarTranslucent",
  "navigationBarTranslucent",
  "onRequestClose",
  "onShow",
  "onDismiss",
  "presentationStyle",
  "supportedOrientations",
  "hardwareAccelerated"
];

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
  const { style, onPress, onPressIn, onPressOut, disabled, children, ...rest } = props;
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
    // Mantener pulsado: fireEvent.mouseDown / mouseUp.
    onMouseDown: onPressIn,
    onMouseUp: onPressOut,
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

export const Modal = forwardRef<any, any>((props, ref) => {
  const { visible = true, children, testID, ...rest } = props;

  if (!visible) {
    return null;
  }

  const htmlProps = mapRnPropsToProps(rest);

  return h(
    "div",
    { ...htmlProps, "data-testid": testID ?? "rn-modal", ref },
    children
  );
});
Modal.displayName = "Modal";

/* ---- Añadidos del sistema de diseño (TextInput, teclado, dimensiones…) ---- */

const TEXT_INPUT_ONLY = [
  "placeholderTextColor",
  "cursorColor",
  "selectionColor",
  "keyboardType",
  "autoCapitalize",
  "autoCorrect",
  "returnKeyType",
  "textAlignVertical",
  "textContentType",
  "autoComplete",
  "inputMode",
  "blurOnSubmit",
  "submitBehavior",
  "enterKeyHint",
  "underlineColorAndroid",
  "scrollEnabled"
];

export const TextInput = forwardRef<any, any>((props, ref) => {
  const { style, onChangeText, onChange, onSubmitEditing, multiline, editable, secureTextEntry, ...rest } = props;
  const htmlProps = mapRnPropsToProps(rest);
  for (const key of TEXT_INPUT_ONLY) {
    delete htmlProps[key];
  }
  return h(multiline ? "textarea" : "input", {
    ...htmlProps,
    ref,
    readOnly: editable === false ? true : undefined,
    type: multiline ? undefined : secureTextEntry ? "password" : "text",
    style: flattenStyle(style),
    onChange: (event: any) => {
      onChange?.(event);
      onChangeText?.(event.target.value);
    },
    onKeyDown: (event: any) => {
      if (event.key === "Enter" && !multiline) {
        onSubmitEditing?.({ nativeEvent: { text: event.target.value } });
      }
    }
  });
});
TextInput.displayName = "TextInput";

export const KeyboardAvoidingView = forwardRef<any, any>((props, ref) => {
  const { style, behavior, enabled, keyboardVerticalOffset, contentContainerStyle, ...rest } = props;
  return h("div", { ...mapRnPropsToProps(rest), style: flattenStyle(style), ref });
});
KeyboardAvoidingView.displayName = "KeyboardAvoidingView";

export const Image = createComponent("img", "Image");

const noopSubscription = () => ({ remove() {} });

export const Keyboard = {
  addListener: noopSubscription,
  dismiss() {},
  isVisible: () => false
};

export const AccessibilityInfo = {
  announceForAccessibility() {},
  isReduceMotionEnabled: async () => false,
  isScreenReaderEnabled: async () => false,
  addEventListener: noopSubscription
};

const windowMetrics = { width: 390, height: 844, scale: 2, fontScale: 1 };

export const Dimensions = {
  get: () => windowMetrics,
  addEventListener: noopSubscription
};

export function useWindowDimensions() {
  return windowMetrics;
}

export const BackHandler = {
  addEventListener: noopSubscription,
  exitApp() {}
};

export const I18nManager = { isRTL: false };

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  roundToNearestPixel: (value: number) => value
};

Object.assign(StyleSheet, {
  hairlineWidth: 1,
  absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }
});

Object.assign(Platform, {
  select: (options: Record<string, unknown>) => options.web ?? options.default
});

export const Linking = {
  openURL: async (_url: string) => undefined,
  canOpenURL: async (_url: string) => true
};

/** App siempre en primer plano en los tests (sondeos, sockets y «marcar leído» lo consultan). */
export const AppState = {
  currentState: "active",
  addEventListener: noopSubscription
};
