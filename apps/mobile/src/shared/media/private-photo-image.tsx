import { Image, type ImageProps } from "expo-image";
import { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { signedPhotoInfo } from "./private-photo";

type Renew = (key: string) => Promise<string>;
export const PrivatePhotoAccessContext = createContext<Renew | null>(null);

/** Refreshes visible private images; never adds an authentication proxy for the bytes. */
export function PrivatePhotoImage({ source, ...props }: ImageProps) {
  const renew = useContext(PrivatePhotoAccessContext);
  const uri = typeof source === "string" ? source : source && typeof source === "object" && "uri" in source ? source.uri : undefined;
  const [resolved, setResolved] = useState<{ original: typeof uri; value: string | null }>({ original: uri, value: uri ?? null });
  const current = resolved.original === uri ? resolved.value : uri;

  useEffect(() => {
    const info = signedPhotoInfo(uri);
    if (!info || !renew) return;
    let cancelled = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let value = uri!;
    let active = !AppState?.currentState || AppState.currentState === "active";

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (active) void refresh(); }, Math.max(1000, delay));
    };
    const refresh = async () => {
      if (pending || cancelled || !active) return;
      pending = true;
      try {
        const fresh = await renew(info.key);
        if (cancelled) return;
        value = fresh;
        setResolved({ original: uri, value: fresh });
        schedule((signedPhotoInfo(fresh)?.expiresAt ?? Date.now() + 120_000) - Date.now() - 60_000);
      } catch (error) {
        if (cancelled) return;
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403 || status === 404) {
          setResolved({ original: uri, value: null });
        } else {
          if (Date.now() >= (signedPhotoInfo(value)?.expiresAt ?? 0)) setResolved({ original: uri, value: null });
          schedule(30_000);
        }
      } finally {
        pending = false;
      }
    };
    const resume = (state: string) => {
      active = state === "active";
      if (active) {
        const remaining = (signedPhotoInfo(value)?.expiresAt ?? 0) - Date.now() - 60_000;
        if (remaining <= 0) void refresh(); else schedule(remaining);
      } else if (timer) clearTimeout(timer);
    };
    const subscription = AppState?.addEventListener?.("change", resume);
    resume(active ? "active" : "background");
    return () => { cancelled = true; if (timer) clearTimeout(timer); subscription?.remove(); };
  }, [uri, renew]);

  const privateSource = signedPhotoInfo(uri);
  return <Image {...props} source={privateSource ? current ? { uri: current } : null : source}
    cachePolicy={privateSource ? "memory" : props.cachePolicy} recyclingKey={privateSource ? current ?? "revoked" : props.recyclingKey} />;
}
