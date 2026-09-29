import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DiscoveryProfileCard, ProfileTag } from "@snack/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { toProfilePerson } from "../domain/person";
import { BioNote } from "./bio-note";
import { IntentBadge } from "./intent-badge";
import { NameSticker } from "./name-sticker";
import { PhotoCarousel } from "./photo-carousel";
import { ProfileBadges } from "./profile-badges";
import { ProfileSummary } from "./profile-summary";
import { TagCloud } from "./tag-cloud";

function tag(id: string, overrides: Partial<ProfileTag> = {}): ProfileTag {
  return { id, slug: id, label: id, category: "interests", sortOrder: 1, emoji: null, shared: false, ...overrides };
}

function card(overrides: Partial<DiscoveryProfileCard> = {}): DiscoveryProfileCard {
  return {
    id: "p1",
    displayName: "Lucía",
    age: 29,
    bio: "Me encanta el café de especialidad.",
    gender: "woman",
    whatIAmLookingFor: "relationship",
    distanceLabel: "A unos 3 km",
    distanceKmApprox: 3,
    score: 1,
    sharedTagsCount: 1,
    photoUrl: "https://x/1.jpg",
    photoCount: 3,
    photos: [
      { id: "a", url: "https://x/1.jpg", position: 1 },
      { id: "b", url: "https://x/2.jpg", position: 2 },
      { id: "c", url: "https://x/3.jpg", position: 3 }
    ],
    tags: [
      tag("Senderismo", { shared: true, category: "active" }),
      tag("Gatos", { category: "pets" }),
      tag("Cine", { category: "interests" })
    ],
    likedYou: true,
    isNewcomer: true,
    beyondPreferredDistance: false,
    ...overrides
  };
}

describe("PhotoCarousel", () => {
  it("shows the current photo and steps with the tap zones", () => {
    renderWithTheme(
      <PhotoCarousel height={400} name="Lucía" photos={card().photos} testID="carousel" width={300} />
    );

    const shown = () => screen.getByTestId("expo-image").textContent;
    expect(shown()).toBe("https://x/1.jpg");

    fireEvent.click(screen.getByTestId("carousel-next"));
    expect(shown()).toBe("https://x/2.jpg");

    fireEvent.click(screen.getByTestId("carousel-prev"));
    fireEvent.click(screen.getByTestId("carousel-prev"));
    expect(shown()).toBe("https://x/1.jpg");
  });

  it("follows a controlled index and reports changes", () => {
    const onIndexChange = vi.fn();
    renderWithTheme(
      <PhotoCarousel
        height={400}
        index={2}
        name="Lucía"
        onIndexChange={onIndexChange}
        photos={card().photos}
        testID="carousel"
        width={300}
      />
    );

    expect(screen.getByTestId("expo-image").textContent).toBe("https://x/3.jpg");
    fireEvent.click(screen.getByTestId("carousel-prev"));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("shows a friendly placeholder without photos", () => {
    renderWithTheme(<PhotoCarousel height={200} name="mar" photos={[]} width={200} />);

    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Aún sin fotos")).toBeInTheDocument();
  });
});

describe("profile atoms", () => {
  it("NameSticker announces name and age", () => {
    renderWithTheme(<NameSticker age={29} name="Lucía" />);

    expect(screen.getByLabelText("Lucía, 29 años")).toBeInTheDocument();
  });

  it("ProfileBadges renders the badge system with explicit labels", () => {
    renderWithTheme(<ProfileBadges person={toProfilePerson(card())} testID="badges" />);

    expect(screen.getByText("Nuevo")).toBeInTheDocument();
    expect(screen.getByText("Te ha dado like")).toBeInTheDocument();
    expect(screen.getByText("1 en común")).toBeInTheDocument();
    expect(screen.getByLabelText("Lucía ya te ha dado like: si le das like, es match")).toBeInTheDocument();
  });

  it("IntentBadge reads the intent as a sentence", () => {
    renderWithTheme(<IntentBadge intent="meet_people" />);

    expect(screen.getByLabelText("Quiere conocer gente")).toBeInTheDocument();
    expect(screen.getByText("Conocer gente")).toBeInTheDocument();
  });

  it("BioNote renders nothing without a bio", () => {
    const { container } = renderWithTheme(<BioNote bio="   " />);

    expect(container.textContent).toBe("");
  });

  it("TagCloud groups shared tags first and the rest by category", () => {
    renderWithTheme(<TagCloud layout="grouped" tags={card().tags} />);

    expect(screen.getByText("1 en común contigo")).toBeInTheDocument();
    expect(screen.getByText("Intereses")).toBeInTheDocument();
    expect(screen.getByText("Mascotas")).toBeInTheDocument();
    expect(screen.getByLabelText("Senderismo, en común")).toBeInTheDocument();
  });

  it("ProfileSummary (full) shows intent, distance, bio and grouped tags", () => {
    renderWithTheme(<ProfileSummary profile={card()} testID="summary" variant="full" />);

    expect(screen.getByLabelText("Busca una relación")).toBeInTheDocument();
    expect(screen.getByText("A unos 3 km")).toBeInTheDocument();
    expect(screen.getByLabelText("Bio: Me encanta el café de especialidad.")).toBeInTheDocument();
    expect(screen.getByText("1 en común contigo")).toBeInTheDocument();
    // In the full variant «en común» heads the tags, so it is not repeated as a badge.
    expect(screen.queryByText("1 en común")).not.toBeInTheDocument();
  });
});
