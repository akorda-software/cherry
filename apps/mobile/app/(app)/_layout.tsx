import type { PropsWithChildren } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Slot, Stack } from "expo-router";

import { useSessionShell } from "../../src/features/auth/presentation";
import { optionalStackScreens } from "../../src/features/optional-modules";
import { ShellScaffold } from "../../src/shared/ui/app-shell";

function PrivateGuard({ children }: PropsWithChildren) {
  const { state } = useSessionShell();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.status === "signed-out") {
    return <Redirect href="/(public)/login" />;
  }

  return <>{children}</>;
}

export function PrivateLayout({ children }: PropsWithChildren) {
  return (
    <PrivateGuard>
      <ShellScaffold>{children ?? <Slot />}</ShellScaffold>
    </PrivateGuard>
  );
}

export default function PrivateLayoutRoute() {
  return (
    <PrivateLayout>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ title: "Home" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        {optionalStackScreens.map((screen) => (
          <Stack.Screen key={screen.name} name={screen.name} options={{ title: screen.title }} />
        ))}
      </Stack>
    </PrivateLayout>
  );
}
