import type { ReactNode } from "react";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Heading } from "../primitives/heading";
import { Inline } from "../primitives/inline";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppHeader({ actions, subtitle, title }: AppHeaderProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          paddingBottom: theme.primitives.spacing.sm,
          borderBottomWidth: theme.primitives.border.heavy,
          borderColor: theme.primitives.color.ink
        }
      }),
    [theme]
  );

  return (
    <View role="banner" style={styles.banner}>
      <Inline style={{ justifyContent: "space-between" }}>
        <Stack>
          <Heading level={1}>{title}</Heading>
          {subtitle ? <Text>{subtitle}</Text> : null}
        </Stack>
        {actions}
      </Inline>
    </View>
  );
}
