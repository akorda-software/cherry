import type { PropsWithChildren } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Slot, Stack } from "expo-router";

import { useLogoutAction, useSessionShell } from "../../src/features/auth/presentation";
import { SubscriptionFeatureProvider } from "../../src/features/subscriptions/presentation";
import { useFeatureFlag } from "../../src/shared/config";
import { DrawerContent, ShellScaffold } from "../../src/shared/ui/app-shell";

interface PrivateLayoutProps extends PropsWithChildren {
  subscriptionEnabled?: boolean | null;
}

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

export function PrivateLayout({ children, subscriptionEnabled = null }: PrivateLayoutProps) {
  const logout = useLogoutAction();
  const runtimeSubscriptionFlag = useFeatureFlag("subscriptions");
  const resolvedSubscriptionEnabled = subscriptionEnabled ?? runtimeSubscriptionFlag.enabled;

  return (
    <PrivateGuard>
      <SubscriptionFeatureProvider>
        <ShellScaffold
          onLogout={() => void logout()}
          subscriptionEnabled={resolvedSubscriptionEnabled}
        >
          {children ?? <Slot />}
        </ShellScaffold>
      </SubscriptionFeatureProvider>
    </PrivateGuard>
  );
}

export default function PrivateLayoutRoute() {
  return (
    <PrivateLayout>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ title: "Home" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="subscriptions" options={{ title: "Subscription" }} />
      </Stack>
    </PrivateLayout>
  );
}
