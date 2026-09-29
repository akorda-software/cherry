import { useStore } from "zustand";

import { createDiscoveryPreferencesStore, type DiscoveryPreferencesDeps, type DiscoveryPreferencesStore } from "./discovery-preferences";
import { createDiscoveryQueue, type DiscoveryQueueDeps, type DiscoveryQueueStore } from "./discovery-queue";
import { onSignOut } from "../../auth/presentation/on-sign-out";

/*
 * Instancias únicas de la cola y de las preferencias de Descubrir: las comparten el
 * modo swipe, el feed, el perfil completo y los filtros. Sus dependencias (API
 * autenticada, precarga de imágenes, celebración de match) las inyecta
 * `useDiscoveryRuntime()` desde la capa de presentación.
 */

let queueDeps: DiscoveryQueueDeps | null = null;
let preferencesDeps: DiscoveryPreferencesDeps | null = null;

export const discoveryQueueStore = createDiscoveryQueue(() => queueDeps);
export const discoveryPreferencesStore = createDiscoveryPreferencesStore(() => preferencesDeps);

export function configureDiscoveryQueue(deps: DiscoveryQueueDeps) {
  queueDeps = deps;
}

export function configureDiscoveryPreferences(deps: DiscoveryPreferencesDeps) {
  preferencesDeps = deps;
}

export function useDiscoveryQueue<T>(selector: (state: DiscoveryQueueStore) => T): T {
  return useStore(discoveryQueueStore, selector);
}

export function useDiscoveryPreferences<T>(selector: (state: DiscoveryPreferencesStore) => T): T {
  return useStore(discoveryPreferencesStore, selector);
}

// Otra cuenta en el mismo dispositivo nunca hereda la cola ni las preferencias.
onSignOut(() => {
  discoveryQueueStore.getState().reset();
  discoveryPreferencesStore.getState().reset();
});
