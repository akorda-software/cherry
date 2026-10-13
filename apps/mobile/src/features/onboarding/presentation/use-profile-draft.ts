import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { createProfileApi } from "@cherry/mobile-shared";

import { useAppBootstrap } from "../../app-bootstrap";
import { useAuthedApi } from "../../auth/presentation";
import { loadProfileDraft, loadTagCatalog, useProfileDraftStore } from "../application/profile-draft-store";

/** `callApi` autenticado para `ProfileApi` (token fresco + reintento ante 401). */
export function useProfileCallApi() {
  return useAuthedApi(createProfileApi);
}

/** Id y nombre de la cuenta (se recuerdan aunque el bootstrap se esté refrescando). */
export function useAccountIdentity(): { userId: string | null; accountName: string | null } {
  const { state } = useAppBootstrap();
  const last = useRef<{ userId: string | null; accountName: string | null }>({ userId: null, accountName: null });

  if (state.status === "ready") {
    last.current = { userId: state.bootstrap.user.id, accountName: state.bootstrap.user.displayName };
  }

  return last.current;
}

/**
 * Borrador del perfil propio (compartido por pasos y pantallas de edición).
 * Lo carga si hace falta; `refresh` fuerza pedirlo de nuevo al montar.
 */
export function useProfileDraft({ refresh = false }: { refresh?: boolean } = {}) {
  const callApi = useProfileCallApi();
  const { userId } = useAccountIdentity();
  const draft = useProfileDraftStore(
    useShallow((state) => ({ status: state.status, profile: state.profile, error: state.error, owner: state.userId }))
  );

  useEffect(() => {
    if (userId) {
      void loadProfileDraft(callApi, userId, { force: refresh }).catch(() => undefined);
    }
    // `refresh` solo cuenta al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callApi, userId]);

  const retry = useCallback(() => {
    if (userId) {
      void loadProfileDraft(callApi, userId, { force: true }).catch(() => undefined);
    }
  }, [callApi, userId]);

  const ready = draft.status === "ready" && (userId === null || draft.owner === userId);

  return {
    callApi,
    ready,
    loading: !ready && draft.status !== "error",
    failed: draft.status === "error",
    error: draft.error,
    profile: ready ? draft.profile : null,
    retry
  };
}

/** Catálogo de etiquetas (precargado desde la reanudación del onboarding). */
export function useTagCatalog() {
  const callApi = useProfileCallApi();
  const { catalog, catalogStatus } = useProfileDraftStore(
    useShallow((state) => ({ catalog: state.catalog, catalogStatus: state.catalogStatus }))
  );

  useEffect(() => {
    void loadTagCatalog(callApi).catch(() => undefined);
  }, [callApi]);

  const retry = useCallback(() => {
    void loadTagCatalog(callApi, { force: true }).catch(() => undefined);
  }, [callApi]);

  return { catalog, failed: catalogStatus === "error" && !catalog, retry };
}
