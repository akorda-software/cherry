import type { ProfileApi } from "@cherry/mobile-shared";

import type { TagEditorApi } from "./use-tag-editor";

type CallProfileApi = <T>(run: (api: ProfileApi) => Promise<T>) => Promise<T>;

/** Adapta `callApi` de `useAuthedApi(createProfileApi)` a lo que necesita `useTagEditor().save`. */
export function bindTagEditorApi(callApi: CallProfileApi): TagEditorApi {
  return {
    setPositiveTags: (ids) => callApi((api) => api.setPositiveTags(ids)),
    setBlockedTags: (ids) => callApi((api) => api.setBlockedTags(ids)),
    getPositiveTags: () => callApi((api) => api.getPositiveTags()),
    getBlockedTags: () => callApi((api) => api.getBlockedTags())
  };
}
