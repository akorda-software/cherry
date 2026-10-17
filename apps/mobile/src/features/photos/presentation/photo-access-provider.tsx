import { useCallback, useMemo, type PropsWithChildren } from "react";
import { createPhotoAccessApi } from "@cherry/mobile-shared";
import { useAuthedApi } from "../../auth/presentation/use-authed-api";
import { PrivatePhotoAccessContext } from "../../../shared/media/private-photo-image";

export function PhotoAccessProvider({ children }: PropsWithChildren) {
  const callApi = useAuthedApi(createPhotoAccessApi);
  // Only in-flight requests, no gallery or signed-URL cache survives the call.
  const pending = useMemo(() => new Map<string, Promise<string>>(), [callApi]);
  const renew = useCallback((key: string) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = callApi((api) => api.renew(key)).then((response) => response.url).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }, [callApi, pending]);
  return <PrivatePhotoAccessContext.Provider value={renew}>{children}</PrivatePhotoAccessContext.Provider>;
}
