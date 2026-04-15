import type { ReactNode } from "react";
import { View } from "react-native";

import { Heading } from "../primitives/heading";
import { Inline } from "../primitives/inline";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppHeader({ actions, subtitle, title }: AppHeaderProps) {
  return (
    <View role="banner">
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
