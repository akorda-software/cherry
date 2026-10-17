import type { PhotoReadUrlResponse } from "@cherry/contracts";
import type { HttpClient } from "./auth-api";

export function createPhotoAccessApi(client: HttpClient) {
  return {
    renew: (storageKey: string) => client.post<PhotoReadUrlResponse>("/api/photos/read-url", { storageKey })
  };
}
