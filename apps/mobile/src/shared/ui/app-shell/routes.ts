export const appShellRoutes = {
  login: "/(public)/login",
  home: "/(app)/(tabs)/home",
  profile: "/(app)/(tabs)/profile",
  settings: "/(app)/settings",
  subscriptions: "/(app)/subscriptions"
} as const;

export const tabItems = [
  { label: "Home", href: appShellRoutes.home, icon: "⌂" },
  { label: "Profile", href: appShellRoutes.profile, icon: "👤" }
] as const;

export function getShellTitle(pathname: string) {
  if (pathname === appShellRoutes.profile) {
    return "Profile";
  }

  if (pathname === appShellRoutes.settings) {
    return "Settings";
  }

  if (pathname === appShellRoutes.subscriptions) {
    return "Subscription";
  }

  return "Home";
}
