import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Icon,
  KawaiiTabBar,
  TabBarSpaceContext,
  tabBarSpace,
  tabItems,
  type TabRouteName,
  useTabBadgesStore,
  useTheme
} from "../../../src/shared/ui";

export default function TabsLayoutRoute() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const likes = useTabBadgesStore((state) => state.likes);
  const chats = useTabBadgesStore((state) => state.chats);
  const space = tabBarSpace(insets.bottom);
  const p = theme.primitives.pastel;

  const stickers: Record<TabRouteName, string> = {
    discover: p.fresa.fill,
    likes: p.limonada.fill,
    chats: p.cielo.fill,
    me: p.lavanda.fill
  };
  const badges: Partial<Record<TabRouteName, number>> = { likes, chats };

  return (
    <TabBarSpaceContext.Provider value={space}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.semantic.color.screenBackground },
          tabBarStyle: { height: space }
        }}
        tabBar={(props) => <KawaiiTabBar {...props} />}
      >
        {tabItems.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarButtonTestID: `tab-${tab.name}`,
              tabBarActiveBackgroundColor: stickers[tab.name],
              tabBarBadge: badges[tab.name] || undefined,
              tabBarIcon: ({ focused, color }) => (
                <Icon
                  color={color}
                  fill={focused ? theme.primitives.color.white : undefined}
                  name={tab.icon}
                  size={26}
                />
              )
            }}
          />
        ))}
      </Tabs>
    </TabBarSpaceContext.Provider>
  );
}
