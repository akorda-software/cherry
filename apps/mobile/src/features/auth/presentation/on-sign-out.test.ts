import { describe, expect, it } from "vitest";

import type { DiscoveryMatch, DiscoveryProfileCard, Profile } from "@cherry/contracts";

import { discoveryPreferencesStore, discoveryQueueStore } from "../../discovery/application/discovery-runtime";
import { useProfileTransitStore } from "../../discovery/application/profile-transit";
import { useOwnPhotoStore } from "../../match/application/own-photo-store";
import { useMatchCelebrationStore } from "../../match/match-celebration-store";
import { useProfileDraftStore } from "../../onboarding/application/profile-draft-store";
import { useSessionStore } from "./session-store";

const card = { id: "p1", displayName: "Ada" } as unknown as DiscoveryProfileCard;
const match = { id: "m1", conversationId: "c1" } as unknown as DiscoveryMatch;

function signIn() {
  useSessionStore.setState({
    status: "signed-in",
    session: {
      accessToken: "a",
      accessTokenExpiresAt: "2099-01-01T00:00:00Z",
      refreshToken: "r",
      refreshTokenExpiresAt: "2099-01-01T00:00:00Z",
      user: { id: "u1", email: "ada@cherry.dev", displayName: "Ada" }
    }
  });
}

describe("onSignOut", () => {
  it("clears every per-account store when the session ends, so another account never sees it", () => {
    signIn();

    discoveryQueueStore.setState({ ownerId: "u1", status: "ready", profiles: [card] });
    discoveryPreferencesStore.setState({ status: "ready", mode: "feed" });
    useProfileTransitStore.setState({ entries: { p1: { profile: card, origin: "other", stagedAt: 1 } } });
    useMatchCelebrationStore.setState({ match, queue: [match] });
    useOwnPhotoStore.setState({ ownerId: "u1", url: "https://example.com/me.jpg", displayName: "Ada", status: "ready" });
    useProfileDraftStore.setState({ userId: "u1", status: "ready", profile: { id: "me" } as unknown as Profile });

    useSessionStore.setState({ status: "signed-out", session: null });

    expect(discoveryQueueStore.getState().profiles).toEqual([]);
    expect(discoveryQueueStore.getState().ownerId).toBeNull();
    expect(discoveryPreferencesStore.getState().status).toBe("idle");
    expect(useProfileTransitStore.getState().entries).toEqual({});
    expect(useMatchCelebrationStore.getState()).toMatchObject({ match: null, queue: [] });
    expect(useOwnPhotoStore.getState()).toMatchObject({ ownerId: null, url: null, status: "idle" });
    expect(useProfileDraftStore.getState()).toMatchObject({ userId: null, profile: null, status: "idle" });
  });

  it("does nothing while the session stays signed in", () => {
    signIn();
    useMatchCelebrationStore.setState({ match, queue: [] });

    useSessionStore.setState({ error: null });

    expect(useMatchCelebrationStore.getState().match).toEqual(match);
  });
});
