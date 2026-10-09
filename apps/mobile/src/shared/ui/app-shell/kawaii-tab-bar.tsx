import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { type ReactNode, useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { haptics } from "../motion/haptics";
import { springs } from "../motion/springs";
import { Badge } from "../primitives/badge";
import { HardShadow } from "../primitives/hard-shadow";
import { useTheme } from "../providers/theme-provider";

/** Alto de la pastilla. */
export const TAB_BAR_HEIGHT = 68;

/** Hueco que ocupa la barra flotante sobre el borde inferior (para el contenido). */
export function tabBarSpace(bottomInset: number) {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, 12);
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const show = Keyboard.addListener("keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

/**
 * Barra de pestañas flotante: una pastilla blanca sobre el papel. Todas llevan
 * icono y rótulo; la activa se convierte en una pegatina pastel y hace pop.
 * Lee de cada pantalla `title`, `tabBarIcon`, `tabBarBadge`,
 * `tabBarActiveBackgroundColor` (color de la pegatina) y `tabBarButtonTestID`.
 */
export function KawaiiTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.host,
        { bottom: Math.max(insets.bottom, 12), left: 16 + insets.left, right: 16 + insets.right }
      ]}
    >
      <HardShadow
        accessibilityRole="tablist"
        elevation="md"
        style={[
          styles.bar,
          {
            height: TAB_BAR_HEIGHT,
            borderRadius: TAB_BAR_HEIGHT / 2,
            borderWidth: theme.primitives.border.bold,
            borderColor: c.ink,
            backgroundColor: c.white
          }
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key] ?? { options: {} };
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string" ? options.tabBarLabel : (options.title ?? route.name);
          const badge = options.tabBarBadge;
          const count = typeof badge === "number" ? badge : typeof badge === "string" ? Number(badge) || 0 : 0;

          function onPress() {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptics.selection();
              navigation.navigate(route.name, route.params);
            }
          }

          function onLongPress() {
            navigation.emit({ type: "tabLongPress", target: route.key });
          }

          return (
            <KawaiiTab
              accessibilityLabel={
                (options.tabBarAccessibilityLabel ?? label) + (count > 0 ? `, ${count} ${count === 1 ? "nuevo" : "nuevos"}` : "")
              }
              badge={count}
              color={options.tabBarActiveBackgroundColor ?? theme.primitives.pastel.fresa.fill}
              focused={focused}
              icon={options.tabBarIcon?.({ focused, color: c.ink, size: 26 }) ?? null}
              index={index}
              key={route.key}
              label={label}
              onLongPress={onLongPress}
              onPress={onPress}
              testID={options.tabBarButtonTestID}
            />
          );
        })}
      </HardShadow>
    </View>
  );
}

interface KawaiiTabProps {
  label: string;
  icon: ReactNode;
  focused: boolean;
  color: string;
  badge: number;
  index: number;
  accessibilityLabel: string;
  testID?: string;
  onPress(): void;
  onLongPress(): void;
}

function KawaiiTab({ label, icon, focused, color, badge, index, accessibilityLabel, testID, onPress, onLongPress }: KawaiiTabProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const reduced = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(0);
  const rest = index % 2 === 0 ? -3 : 3;

  useEffect(() => {
    if (focused) {
      on.value = reduced ? withTiming(1, { duration: 120 }) : withSpring(1, springs.pop);
    } else {
      on.value = withTiming(0, { duration: 140 });
    }
  }, [focused, on, reduced]);

  const stickerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.value * 1.6),
    transform: [
      { rotate: `${rest - (1 - on.value) * 10}deg` },
      { scale: (0.6 + 0.4 * on.value) * (1 - 0.06 * press.value) }
    ]
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 - 1.5 * on.value }, { scale: 1 - 0.1 * press.value }]
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -1.5 * on.value }, { scale: 1 - 0.04 * press.value }]
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      aria-selected={focused}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(1, springs.snappy);
      }}
      onPressOut={() => {
        press.value = withSpring(0, springs.pop);
      }}
      style={styles.slot}
      testID={testID}
    >
      <HardShadow
        animatedStyle={stickerStyle}
        elevation="sm"
        style={[
          styles.sticker,
          {
            backgroundColor: color,
            borderColor: c.ink,
            borderWidth: theme.primitives.border.regular,
            borderRadius: theme.primitives.radius.md + 2
          }
        ]}
      />
      <Animated.View style={[styles.icon, iconStyle]}>
        {icon}
        {badge > 0 ? <Badge count={badge} size="sm" style={styles.badge} /> : null}
      </Animated.View>
      {/* Rótulo siempre visible (reconocer > recordar); la activa lo remarca en tinta plena. */}
      <Animated.Text
        allowFontScaling
        maxFontSizeMultiplier={1.1}
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: focused ? c.ink : c.inkSoft,
            fontFamily: focused ? theme.primitives.fonts.extraBold : theme.primitives.fonts.bold
          },
          labelStyle
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    alignItems: "center",
    pointerEvents: "box-none"
  },
  bar: {
    alignSelf: "stretch",
    maxWidth: 480,
    width: "100%",
    marginHorizontal: "auto",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5
  },
  slot: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  sticker: {
    position: "absolute",
    top: 5,
    bottom: 5,
    left: 2,
    right: 2
  },
  icon: {
    alignItems: "center",
    justifyContent: "center"
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -12
  },
  label: {
    position: "absolute",
    bottom: 10,
    left: 5,
    right: 5,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14
  }
});
