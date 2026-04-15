import { useRouter } from "expo-router";
import { View } from "react-native";

import { NavListItem } from "../composites/nav-list-item";
import { Stack } from "../primitives/stack";
import { drawerItems, subscriptionDrawerItem } from "./routes";

interface DrawerContentProps {
  onLogout(): void;
  subscriptionEnabled?: boolean;
}

export function DrawerContent({ onLogout, subscriptionEnabled = false }: DrawerContentProps) {
  const router = useRouter();

  return (
    <View accessibilityLabel="Drawer navigation" role="navigation">
      <Stack>
        {drawerItems.map((item) => (
          <NavListItem key={item.href} label={item.label} onPress={() => router.replace(item.href)} />
        ))}
        {subscriptionEnabled ? (
          <NavListItem
            key={subscriptionDrawerItem.href}
            label={subscriptionDrawerItem.label}
            onPress={() => router.replace(subscriptionDrawerItem.href)}
          />
        ) : null}
        <NavListItem label="Logout" onPress={onLogout} />
      </Stack>
    </View>
  );
}
