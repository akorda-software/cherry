import type { IconName } from "../art";

/** Rutas canónicas de la app (grupos de expo-router incluidos). */
export const appShellRoutes = {
  login: "/(public)/login",
  onboarding: "/(onboarding)",
  discover: "/(app)/(tabs)/discover",
  likes: "/(app)/(tabs)/likes",
  chats: "/(app)/(tabs)/chats",
  me: "/(app)/(tabs)/me",
  settings: "/(app)/settings",
  filters: "/(app)/filters",
  about: "/(app)/about",
  editPhotos: "/(app)/edit/photos",
  editTags: "/(app)/edit/tags",
  editBio: "/(app)/edit/bio",
  editBasics: "/(app)/edit/basics",
  /** @deprecated la pestaña se llama `discover`. */
  home: "/(app)/(tabs)/discover",
  /** @deprecated la pestaña se llama `me`. */
  profile: "/(app)/(tabs)/me"
} as const;

/** Perfil completo de otra persona. */
export function profileHref(id: string) {
  return { pathname: "/(app)/profile/[id]", params: { id } } as const;
}

/** Conversación de un match. */
export function chatHref(id: string) {
  return { pathname: "/(app)/chat/[id]", params: { id } } as const;
}

export type TabRouteName = "discover" | "likes" | "chats" | "me";

export interface TabItem {
  name: TabRouteName;
  label: string;
  href: string;
  icon: IconName;
}

/** Pestañas de la zona privada, en orden. */
export const tabItems: readonly TabItem[] = [
  { name: "discover", label: "Descubrir", href: appShellRoutes.discover, icon: "cards" },
  { name: "likes", label: "Likes", href: appShellRoutes.likes, icon: "heart" },
  { name: "chats", label: "Chats", href: appShellRoutes.chats, icon: "chat" },
  { name: "me", label: "Yo", href: appShellRoutes.me, icon: "user" }
];
