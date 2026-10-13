import { Image } from "expo-image";

/**
 * Precarga fotos para que la siguiente card (o el siguiente post del feed) aparezca ya
 * pintada. Silenciosa: una foto que no se pueda precargar se cargará al mostrarse.
 */
export function prefetchImageUrls(urls: string[]) {
  if (urls.length === 0 || typeof Image.prefetch !== "function") {
    return;
  }

  Image.prefetch(urls, "memory-disk").catch(() => undefined);
}
