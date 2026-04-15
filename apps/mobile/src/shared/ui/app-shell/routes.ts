export const appShellRoutes = {
  login: "/(public)/login",
  home: "/(app)/(tabs)/home",
  user: "/(app)/(tabs)/user",
  settings: "/(app)/settings",
  subscriptions: "/(app)/subscriptions"
} as const;

export const tabItems = [
  { label: "Tab Home", href: appShellRoutes.home, icon: "⌂" },
  { label: "Tab User", href: appShellRoutes.user, icon: "☺" }
] as const;

export const drawerItems = [
  { label: "Drawer Home", href: appShellRoutes.home },
  { label: "Drawer User", href: appShellRoutes.user },
  { label: "Drawer Settings", href: appShellRoutes.settings }
] as const;

export const subscriptionDrawerItem = {
  label: "Drawer Subscription",
  href: appShellRoutes.subscriptions
} as const;

export function getShellTitle(pathname: string) {
  if (pathname === appShellRoutes.user) {
    return "User";
  }

  if (pathname === appShellRoutes.settings) {
    return "Settings";
  }

  if (pathname === appShellRoutes.subscriptions) {
    return "Subscription";
  }

  return "Home";
}
