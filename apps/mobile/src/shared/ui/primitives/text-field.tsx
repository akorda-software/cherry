import { forwardRef, memo, type ReactNode, useEffect, useState } from "react";
import {
  Platform,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle
} from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import type { IconName } from "../art";
import { springs } from "../motion/springs";
import { useShake } from "../motion/wiggle";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { IconSlot } from "./icon-slot";
import { Text } from "./text";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  /** Ayuda bajo el campo (la sustituye el error). */
  hint?: string;
  /** Mensaje de error: tiñe el campo, lo sacude y se anuncia. */
  error?: string | null;
  /** md = formulario · xl = pregunta única gigante del onboarding. */
  size?: "md" | "xl";
  /** Muestra «n/max» (por defecto sí cuando hay `maxLength`). */
  counter?: boolean;
  /** Menos relleno lateral, para campos estrechos (DD / MM / AAAA). */
  dense?: boolean;
  icon?: IconName;
  /** Nodo a la derecha dentro del campo (p. ej. botón de limpiar). */
  right?: ReactNode;
  /** Resaltador al enfocar (por defecto limonada). */
  color?: PastelName;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Campo de libreta: contorno de tinta; al enfocar se «resalta» con un pastel
 * suave y la sombra crece. El error lo sacude y lo tiñe de tomate.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    size = "md",
    counter,
    dense = false,
    icon,
    right,
    color = "limonada",
    containerStyle,
    inputStyle,
    multiline,
    maxLength,
    value,
    defaultValue,
    editable = true,
    onFocus,
    onBlur,
    testID,
    ...inputProps
  },
  ref
) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const xl = size === "xl";
  const [focused, setFocused] = useState(false);
  const { shake, style: shakeStyle } = useShake({ haptic: false });
  const hasError = Boolean(error);
  const length = (value ?? defaultValue ?? "").length;
  const showCounter = (counter ?? maxLength !== undefined) && maxLength !== undefined;

  useEffect(() => {
    if (hasError) {
      shake();
    }
  }, [error, hasError, shake]);

  const restFill = hasError ? theme.semantic.state.dangerSoft : editable ? c.white : c.paperDeep;
  const focusFill = hasError ? theme.semantic.state.dangerSoft : theme.primitives.pastel[color].soft;
  const shadowBase = xl ? 3 : 2;

  const radius = xl ? theme.primitives.radius.lg : theme.primitives.radius.md;
  const border = xl ? theme.primitives.border.bold : theme.primitives.border.regular;
  const font = xl
    ? { fontFamily: theme.primitives.fonts.display, fontSize: 28, lineHeight: 36 }
    : { fontFamily: theme.primitives.fonts.bold, fontSize: 17, lineHeight: 23 };
  const minHeight = multiline ? (xl ? 160 : 120) : xl ? 76 : 56;

  function handleFocus(event: FocusEvent) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: BlurEvent) {
    setFocused(false);
    onBlur?.(event);
  }

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, xl ? styles.labelXl : null]} variant={xl ? "title3" : "label"}>
          {label}
        </Text>
      ) : null}
      <Animated.View style={shakeStyle}>
        <FieldDecoration
          focused={focused}
          focusFill={focusFill}
          ink={c.ink}
          radius={radius}
          restFill={restFill}
          shadowBase={shadowBase}
        />
        <View
          style={[
            styles.face,
            {
              minHeight,
              borderRadius: radius,
              borderWidth: border,
              borderColor: hasError ? theme.semantic.state.danger : c.ink,
              paddingHorizontal: dense ? 6 : xl ? 20 : 16,
              alignItems: multiline ? "flex-start" : "center"
            }
          ]}
        >
          {icon ? (
            <View style={multiline ? styles.iconTop : null}>
              <IconSlot color={c.inkSoft} icon={icon} size={xl ? 26 : 20} />
            </View>
          ) : null}
          <TextInput
            accessibilityHint={error ?? hint}
            accessibilityLabel={label ?? inputProps.accessibilityLabel ?? inputProps.placeholder}
            cursorColor={c.ink}
            defaultValue={defaultValue}
            editable={editable}
            maxFontSizeMultiplier={xl ? 1.2 : 1.4}
            maxLength={maxLength}
            multiline={multiline}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholderTextColor={theme.semantic.text.faint}
            ref={ref}
            selectionColor={c.fresaDeep}
            style={[
              styles.input,
              font,
              {
                color: editable ? theme.semantic.text.default : theme.semantic.text.muted,
                minHeight: minHeight - 2 * border,
                paddingVertical: multiline ? 14 : 0,
                textAlignVertical: multiline ? "top" : "center"
              },
              inputStyle
            ]}
            testID={testID}
            value={value}
            {...inputProps}
          />
          {right}
        </View>
      </Animated.View>
      {hasError || hint || showCounter ? (
        <View style={styles.meta}>
          {hasError ? (
            <View accessibilityLiveRegion="polite" role="alert" style={styles.errorRow}>
              <IconSlot color={theme.semantic.state.danger} icon="alert" size={16} />
              <Text color="danger" style={styles.metaText} variant="caption">
                {error}
              </Text>
            </View>
          ) : hint ? (
            <Text color="muted" style={styles.metaText} variant="caption">
              {hint}
            </Text>
          ) : (
            <View style={styles.metaText} />
          )}
          {showCounter ? (
            <Text
              color={length >= (maxLength ?? 0) ? "danger" : "faint"}
              style={styles.counter}
              variant="caption"
            >
              {`${length}/${maxLength}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

/** Keep focus worklets and their native views out of the per-keystroke render path. */
const FieldDecoration = memo(function FieldDecoration({
  focused,
  focusFill,
  ink,
  radius,
  restFill,
  shadowBase
}: {
  focused: boolean;
  focusFill: string;
  ink: string;
  radius: number;
  restFill: string;
  shadowBase: number;
}) {
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.set(withSpring(focused ? 1 : 0, springs.snappy));
  }, [focus, focused]);

  const faceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.get(), [0, 1], [restFill, focusFill])
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const offset = shadowBase + 2 * focus.get();
    return { transform: [{ translateX: offset }, { translateY: offset }] };
  });

  return (
    <View pointerEvents="none" style={styles.shadow}>
      <Animated.View style={[styles.shadow, { borderRadius: radius, backgroundColor: ink }, shadowStyle]} />
      <Animated.View style={[styles.shadow, { borderRadius: radius }, faceStyle]} />
    </View>
  );
});

type FocusEvent = Parameters<NonNullable<TextInputProps["onFocus"]>>[0];
type BlurEvent = Parameters<NonNullable<TextInputProps["onBlur"]>>[0];

const styles = StyleSheet.create({
  label: {
    marginBottom: 8
  },
  labelXl: {
    marginBottom: 12
  },
  shadow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  face: {
    flexDirection: "row",
    gap: 10
  },
  iconTop: {
    paddingTop: 15
  },
  input: {
    flex: 1,
    // En web el <input> tiene ancho intrínseco (~20ch): sin esto desborda y el foco desplaza la página.
    minWidth: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null)
  },
  meta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 10
  },
  errorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metaText: {
    flex: 1
  },
  counter: {
    fontVariant: ["tabular-nums"]
  }
});
