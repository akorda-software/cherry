import { resolveOptionalShellTitle } from "../../../features/optional-modules";

export const appShellRoutes = {
  login: "/(public)/login",
  home: "/(app)/(tabs)/home",
  profile: "/(app)/(tabs)/profile",
  settings: "/(app)/settings"
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

  const optionalTitle = resolveOptionalShellTitle(pathname);

  if (optionalTitle !== null) {
    return optionalTitle;
  }

  return "Home";
}
