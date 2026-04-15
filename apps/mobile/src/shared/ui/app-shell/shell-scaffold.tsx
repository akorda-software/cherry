import type { PropsWithChildren } from "react";
import { usePathname, useRouter } from "expo-router";
import { View } from "react-native";

import { AppHeader } from "../composites/app-header";
import { IconButton } from "../primitives/icon-button";
import { Screen } from "../primitives/screen";
import { Stack } from "../primitives/stack";
import { DrawerContent } from "./drawer-content";
import { appShellRoutes, getShellTitle, tabItems } from "./routes";

interface ShellScaffoldProps {
  onLogout(): void;
  subscriptionEnabled?: boolean;
}

// Tabs render for any route under the (tabs) group. Derive the prefix from the
// canonical home path so renames in routes.ts stay in one place.
const TABS_PATH_PREFIX = appShellRoutes.home.replace(/\/home$/, "/");

export function ShellScaffold({
  children,
  onLogout,
  subscriptionEnabled = false
}: PropsWithChildren<ShellScaffoldProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const showTabs = pathname.startsWith(TABS_PATH_PREFIX);

  return (
    <Screen>
      <Stack>
        <AppHeader title={getShellTitle(pathname)} />
        <DrawerContent onLogout={onLogout} subscriptionEnabled={subscriptionEnabled} />
        {showTabs ? (
          <View accessibilityLabel="Tab navigation" role="tablist">
            <Stack>
              {tabItems.map((item) => (
                <IconButton
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  onPress={() => router.replace(item.href)}
                  selected={pathname === item.href}
                />
              ))}
            </Stack>
          </View>
        ) : null}
        <View>{children}</View>
      </Stack>
    </Screen>
  );
}
