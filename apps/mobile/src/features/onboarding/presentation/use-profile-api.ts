import { useCallback } from "react";

import { createProfileApi, type ProfileApi } from "@snack/mobile-shared";

import { useSessionShell } from "../../auth/presentation";
import { useRuntimeConfig } from "../../../shared/config";
import { createJsonHttpClient } from "../../../shared/api";

export function useProfileApi() {
  const { executeAuthenticated } = useSessionShell();
  const { apiBaseUrl } = useRuntimeConfig();

  return useCallback(
    <T,>(run: (api: ProfileApi) => Promise<T>) =>
      executeAuthenticated((token) => {
        const client = createJsonHttpClient({
          apiBaseUrl,
          getHeaders: () => ({ Authorization: `Bearer ${token}` })
        });
        return run(createProfileApi(client));
      }),
    [apiBaseUrl, executeAuthenticated]
  );
}
