import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DiscoveryProfileCard } from "@snack/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { ProfileFeedCard } from "./profile-feed-card";

function card(overrides: Partial<DiscoveryProfileCard> = {}): DiscoveryProfileCard {
  return {
    id: "p1",
    displayName: "Ada",
    age: 30,
    bio: "Hello world",
    gender: "woman",
    whatIAmLookingFor: "relationship",
    distanceLabel: "Cerca de ti",
    distanceKmApprox: 1,
    score: 80,
    sharedTagsCount: 2,
    photoUrl: "https://example.com/a.jpg",
    photoCount: 1,
    ...overrides
  };
}

describe("ProfileFeedCard", () => {
  it("renders the name, age and distance over the photo", () => {
    const { getByText } = renderWithTheme(
      <ProfileFeedCard card={card()} onPress={vi.fn()} />
    );

    expect(getByText("Ada, 30")).toBeTruthy();
    expect(getByText(/Cerca de ti/)).toBeTruthy();
    expect(getByText(/2 en común/)).toBeTruthy();
  });

  it("renders the photo through expo-image when a photo url exists", () => {
    const { getByTestId } = renderWithTheme(
      <ProfileFeedCard card={card({ photoUrl: "https://example.com/a.jpg" })} onPress={vi.fn()} />
    );

    expect(getByTestId("expo-image").textContent).toBe("https://example.com/a.jpg");
  });

  it("shows the photo count badge only when there are multiple photos", () => {
    const { rerender, queryByText, getByText } = renderWithTheme(
      <ProfileFeedCard card={card({ photoCount: 1 })} onPress={vi.fn()} />
    );

    expect(queryByText("3")).toBeNull();

    rerender(
      <ProfileFeedCard card={card({ photoCount: 3 })} onPress={vi.fn()} />
    );

    expect(getByText("3")).toBeTruthy();
  });

  it("calls onPress with the card when pressed", () => {
    const onPress = vi.fn();
    const c = card();

    const { getByTestId } = renderWithTheme(<ProfileFeedCard card={c} onPress={onPress} />);

    fireEvent.click(getByTestId(`discovery-card-${c.id}`));

    expect(onPress).toHaveBeenCalledWith(c);
  });
});
