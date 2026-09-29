import { appShellRoutes } from "../../../shared/ui/app-shell/routes";

/**
 * Destinos a los que navega la pestaña Yo (rutas canónicas del shell). Las pantallas de
 * edición y filtros las construyen otras features; aquí solo se enlazan.
 */
export const meRoutes = {
  editPhotos: appShellRoutes.editPhotos,
  editTags: appShellRoutes.editTags,
  editBio: appShellRoutes.editBio,
  editBasics: appShellRoutes.editBasics,
  filters: appShellRoutes.filters,
  settings: appShellRoutes.settings,
  about: appShellRoutes.about
} as const;

export type MeRoute = (typeof meRoutes)[keyof typeof meRoutes];
