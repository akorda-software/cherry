import { useEffect, useMemo } from "react";

import { createDiscoveryApi, createProfileApi } from "@cherry/mobile-shared";

import { useAuthedApi, useSessionShell } from "../../auth/presentation";
import { celebrateMatch } from "../../likes/application/use-received-likes";
import { DISCOVERY_PAGE_SIZE } from "../application/discovery-queue";
import {
  configureDiscoveryPreferences,
  configureDiscoveryQueue,
  discoveryPreferencesStore,
  discoveryQueueStore
} from "../application/discovery-runtime";
import { prefetchImageUrls } from "../infrastructure/image-prefetch";

let boundOwner: string | null | undefined;

/**
 * Conecta la cola y las preferencias de Descubrir con la API autenticada y con la
 * sesión actual. Llámalo en cada pantalla que las use (Descubrir, perfil completo,
 * filtros): es idempotente.
 */
export function useDiscoveryRuntime() {
  const callDiscovery = useAuthedApi(createDiscoveryApi);
  const callProfile = useAuthedApi(createProfileApi);
  const { state } = useSessionShell();
  const ownerId = state.status === "signed-in" ? state.session.user.id : null;

  // Síncrono (antes de los efectos que cargan): las dependencias deben existir ya.
  useMemo(() => {
    configureDiscoveryQueue({
      fetchPage: (cursor) => callDiscovery((api) => api.getFeed({ cursor, limit: DISCOVERY_PAGE_SIZE })),
      recordAction: (request) => callDiscovery((api) => api.recordAction(request)),
      undo: () => callDiscovery((api) => api.undo()),
      prefetchImages: prefetchImageUrls,
      // Celebración + lista de chats + badge al instante (mismo camino que Likes).
      onMatch: celebrateMatch
    });
    configureDiscoveryPreferences({
      get: async () => (await callProfile((api) => api.getDiscoveryPreferences())).discoveryPreferences,
      update: async (fields) =>
        (await callProfile((api) => api.updateDiscoveryPreferences(fields))).discoveryPreferences
    });
  }, [callDiscovery, callProfile]);

  useEffect(() => {
    if (boundOwner === ownerId) {
      return;
    }

    boundOwner = ownerId;
    discoveryQueueStore.getState().bind(ownerId);
    discoveryPreferencesStore.getState().reset();
  }, [ownerId]);

  return ownerId;
}
