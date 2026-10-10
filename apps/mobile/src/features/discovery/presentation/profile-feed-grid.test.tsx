import { describe, expect, it, vi } from "vitest";

import type { DiscoveryProfileCard } from "@cherry/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { ProfileFeedGrid } from "./profile-feed-grid";

function card(id: string): DiscoveryProfileCard {
  return {
    id,
    displayName: id.toUpperCase(),
    age: 30,
    bio: "Hello",
    gender: "woman",
    whatIAmLookingFor: "relationship",
    distanceLabel: "Cerca de ti",
    distanceKmApprox: 1,
    score: 80,
    sharedTagsCount: 0,
    photoUrl: `https://example.com/${id}.jpg`,
    photoCount: 1
  };
}

describe("ProfileFeedGrid", () => {
  it("renders the empty state when there are no profiles", () => {
    const { getByTestId, queryByTestId } = renderWithTheme(
      <ProfileFeedGrid
        profiles={[]}
        hasMore={false}
        loadingMore={false}
        onOpenCard={vi.fn()}
        onLoadMore={vi.fn()}
        ListEmptyComponent={<div data-testid="empty" />}
      />
    );

    expect(getByTestId("empty")).toBeTruthy();
    expect(queryByTestId("discovery-card-p1")).toBeNull();
  });

  it("renders a card for each profile", () => {
    const { getByTestId, getByText } = renderWithTheme(
      <ProfileFeedGrid
        profiles={[card("p1"), card("p2")]}
        hasMore={false}
        loadingMore={false}
        onOpenCard={vi.fn()}
        onLoadMore={vi.fn()}
      />
    );

    expect(getByTestId("discovery-card-p1")).toBeTruthy();
    expect(getByTestId("discovery-card-p2")).toBeTruthy();
    expect(getByText("P1, 30")).toBeTruthy();
    expect(getByText("P2, 30")).toBeTruthy();
  });

  it("shows the loading footer only while there is more to load or a fetch in flight", () => {
    const { getByTestId, rerender, queryByTestId } = renderWithTheme(
      <ProfileFeedGrid
        profiles={[card("p1")]}
        hasMore
        loadingMore={false}
        onOpenCard={vi.fn()}
        onLoadMore={vi.fn()}
      />
    );

    expect(getByTestId("discovery-loading-more")).toBeTruthy();

    rerender(
      <ProfileFeedGrid
        profiles={[card("p1")]}
        hasMore={false}
        loadingMore={false}
        onOpenCard={vi.fn()}
        onLoadMore={vi.fn()}
      />
    );

    expect(queryByTestId("discovery-loading-more")).toBeNull();
  });
});
