import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileApi } from "@cherry/mobile-shared";
import type { SessionBundle } from "@cherry/contracts";

import { useSessionStore } from "../../auth/presentation/session-store";
import { makePhoto, makeProfile, makeTag } from "../testing/fixtures";
import { loadProfileDraft, loadTagCatalog, useProfileDraftStore } from "./profile-draft-store";

const originalServices = useSessionStore.getState().services;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function profileClient(response: Promise<{ profile: ReturnType<typeof makeProfile> | null }>) {
  const getProfile = vi.fn(() => response);
  const api = { getProfile } as unknown as ProfileApi;
  return { getProfile, callApi: <T,>(run: (api: ProfileApi) => Promise<T>) => run(api) };
}

function catalogClient(response: Promise<ReturnType<typeof makeTag>[]>) {
  const getTagCatalog = vi.fn(() => response);
  const api = { getTagCatalog } as unknown as ProfileApi;
  return { getTagCatalog, callApi: <T,>(run: (api: ProfileApi) => Promise<T>) => run(api) };
}

beforeEach(() => {
  useProfileDraftStore.getState().reset();
  useSessionStore.setState({ status: "signed-out", session: null });
});
afterEach(() => useSessionStore.setState({ status: "signed-out", session: null, services: originalServices }));

function session(userId: string): SessionBundle {
  return {
    accessToken: `test-access-${userId}`,
    accessTokenExpiresAt: "2026-10-15T00:00:00Z",
    refreshToken: `test-refresh-${userId}`,
    refreshTokenExpiresAt: "2026-10-20T00:00:00Z",
    user: { id: userId, displayName: userId, email: `${userId}@example.test` }
  };
}

describe("profile draft requests", () => {
  it("rejects a late save from A without invalidating B's pending profile request", async () => {
    const services = useSessionStore.getState().services;
    useSessionStore.setState({
      status: "signed-in",
      session: session("user-A"),
      services: { ...services, executeAuthenticated: undefined }
    });
    const save = deferred<{ profile: ReturnType<typeof makeProfile> }>();
    const pendingSave = useSessionStore.getState().executeAuthenticated(() => save.promise).then(({ profile }) => {
      useProfileDraftStore.getState().setProfile(profile);
    });

    // A leaves; B starts loading before A's successful PUT response arrives.
    useSessionStore.setState({ status: "signed-out", session: null });
    useSessionStore.setState({ status: "signed-in", session: session("user-B") });
    const responseB = deferred<{ profile: ReturnType<typeof makeProfile> }>();
    const loadB = loadProfileDraft(profileClient(responseB.promise).callApi, "user-B");
    save.resolve({ profile: makeProfile({ id: "profile-A" }) });
    await expect(pendingSave).rejects.toThrow("session_changed");

    const profileB = makeProfile({ id: "profile-B" });
    responseB.resolve({ profile: profileB });
    await loadB;
    expect(useProfileDraftStore.getState()).toMatchObject({ userId: "user-B", profile: profileB, status: "ready" });
    expect(await loadProfileDraft(profileClient(Promise.resolve({ profile: null })).callApi, "user-B")).toBe(profileB);
  });

  it("recovers from a synchronous client error without staying stuck loading", async () => {
    const callApi = () => { throw new Error("Session unavailable"); };
    await expect(loadProfileDraft(callApi, "user-1")).rejects.toThrow("Session unavailable");
    expect(useProfileDraftStore.getState().status).toBe("error");

    const profile = makeProfile();
    await loadProfileDraft(profileClient(Promise.resolve({ profile })).callApi, "user-1");
    expect(useProfileDraftStore.getState().profile).toBe(profile);
  });

  it("shares an in-flight request, including simultaneous forced refreshes, and caches the result", async () => {
    const response = deferred<{ profile: ReturnType<typeof makeProfile> }>();
    const client = profileClient(response.promise);
    const first = loadProfileDraft(client.callApi, "user-1");
    const second = loadProfileDraft(client.callApi, "user-1", { force: true });
    const profile = makeProfile();
    response.resolve({ profile });

    expect(await first).toBe(profile);
    expect(await second).toBe(profile);
    expect(await loadProfileDraft(client.callApi, "user-1")).toBe(profile);
    expect(client.getProfile).toHaveBeenCalledOnce();
  });

  it("ignores an old response after reset and reloading the same account", async () => {
    const old = deferred<{ profile: ReturnType<typeof makeProfile> }>();
    const oldRequest = loadProfileDraft(profileClient(old.promise).callApi, "user-1");
    useProfileDraftStore.getState().reset();
    const current = makeProfile({ displayName: "Actual" });
    await loadProfileDraft(profileClient(Promise.resolve({ profile: current })).callApi, "user-1");
    old.resolve({ profile: makeProfile({ displayName: "Antiguo" }) });
    await oldRequest;

    expect(useProfileDraftStore.getState().profile).toBe(current);
  });

  it("does not overwrite a saved profile with a refresh that started before the save", async () => {
    const original = makeProfile();
    await loadProfileDraft(profileClient(Promise.resolve({ profile: original })).callApi, "user-1");
    const refresh = deferred<{ profile: ReturnType<typeof makeProfile> }>();
    const request = loadProfileDraft(profileClient(refresh.promise).callApi, "user-1", { force: true });
    const saved = makeProfile({ bio: "Mi descripción recién guardada." });
    useProfileDraftStore.getState().setProfile(saved);
    refresh.resolve({ profile: original });
    await request;

    expect(useProfileDraftStore.getState()).toMatchObject({ profile: saved, status: "ready", error: null });
  });

  it("preserves photo changes and ignores a stale refresh error", async () => {
    await loadProfileDraft(profileClient(Promise.resolve({ profile: makeProfile() })).callApi, "user-1");
    const refresh = deferred<{ profile: ReturnType<typeof makeProfile> }>();
    const request = loadProfileDraft(profileClient(refresh.promise).callApi, "user-1", { force: true });
    const photos = [makePhoto(1, { id: "new-photo" })];
    useProfileDraftStore.getState().setPhotos(photos);
    refresh.reject(new Error("Old request failed"));
    await expect(request).rejects.toThrow("Old request failed");

    expect(useProfileDraftStore.getState()).toMatchObject({ status: "ready", error: null });
    expect(useProfileDraftStore.getState().profile?.photos).toBe(photos);
  });
});

describe("tag catalog requests", () => {
  it("recovers from a synchronous client error", async () => {
    const callApi = () => { throw new Error("Session unavailable"); };
    await expect(loadTagCatalog(callApi)).rejects.toThrow("Session unavailable");
    expect(useProfileDraftStore.getState().catalogStatus).toBe("error");
    const catalog = [makeTag(1)];
    await loadTagCatalog(catalogClient(Promise.resolve(catalog)).callApi);
    expect(useProfileDraftStore.getState().catalog).toBe(catalog);
  });

  it("deduplicates forced refreshes and allows retry after an error", async () => {
    const failed = deferred<ReturnType<typeof makeTag>[]>();
    const client = catalogClient(failed.promise);
    const first = loadTagCatalog(client.callApi);
    const second = loadTagCatalog(client.callApi, { force: true });
    failed.reject(new Error("Offline"));
    await expect(first).rejects.toThrow("Offline");
    await expect(second).rejects.toThrow("Offline");
    expect(client.getTagCatalog).toHaveBeenCalledOnce();

    const catalog = [makeTag(1)];
    await loadTagCatalog(catalogClient(Promise.resolve(catalog)).callApi);
    expect(useProfileDraftStore.getState()).toMatchObject({ catalog, catalogStatus: "ready" });
  });

  it("does not repopulate the catalog after reset", async () => {
    const response = deferred<ReturnType<typeof makeTag>[]>();
    const request = loadTagCatalog(catalogClient(response.promise).callApi);
    useProfileDraftStore.getState().reset();
    response.resolve([makeTag(1)]);
    await request;

    expect(useProfileDraftStore.getState()).toMatchObject({ catalog: null, catalogStatus: "idle" });
  });

  it("ignores errors from requests belonging to a previous session", async () => {
    const old = deferred<ReturnType<typeof makeTag>[]>();
    const oldRequest = loadTagCatalog(catalogClient(old.promise).callApi);
    useProfileDraftStore.getState().reset();
    const catalog = [makeTag(2)];
    await loadTagCatalog(catalogClient(Promise.resolve(catalog)).callApi);
    old.reject(new Error("Previous session failed"));
    await expect(oldRequest).rejects.toThrow("Previous session failed");

    expect(useProfileDraftStore.getState()).toMatchObject({ catalog, catalogStatus: "ready" });
  });
});
