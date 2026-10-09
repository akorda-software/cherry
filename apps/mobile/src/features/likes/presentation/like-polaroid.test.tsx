import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReceivedLike } from "@snack/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { LikePolaroid } from "./like-polaroid";

function like(overrides: Partial<ReceivedLike["profile"]> = {}): ReceivedLike {
  return {
    likedAt: "2026-09-29T10:00:00Z",
    profile: {
      id: "p1",
      displayName: "Sergio",
      age: 30,
      bio: null,
      gender: "man",
      lookingFor: ["relationship"],
      distanceLabel: null,
      distanceKmApprox: null,
      score: 0,
      sharedTagsCount: 2,
      photoUrl: "https://example.com/sergio.jpg",
      photoCount: 1,
      photos: [],
      tags: [],
      likedYou: true,
      isNewcomer: false,
      beyondPreferredDistance: false,
      ...overrides
    }
  };
}

function renderCard(props: Partial<Parameters<typeof LikePolaroid>[0]> = {}) {
  const handlers = { onOpen: vi.fn(), onLike: vi.fn(), onPass: vi.fn() };
  renderWithTheme(
    <LikePolaroid
      busy={false}
      enterDelay={0}
      index={0}
      like={like()}
      width={164}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LikePolaroid", () => {
  it("shows who liked you and what you share, without a per-card stamp", () => {
    renderCard();

    expect(screen.getByText("Sergio, 30")).toBeInTheDocument();
    expect(screen.getByText("2 en común")).toBeInTheDocument();
    // The screen title already says «Les gustas»: no «¡Te ha dado like!» stamp on each photo.
    expect(screen.queryByText("¡Te ha dado like!")).not.toBeInTheDocument();
    expect(screen.getByTestId("like-open-p1")).toHaveAttribute(
      "aria-label",
      "Sergio, 30. te ha dado like. 2 etiquetas en común"
    );
  });

  it("opens the profile when tapping the polaroid", () => {
    const { onOpen } = renderCard();
    fireEvent.click(screen.getByTestId("like-open-p1"));
    expect(onOpen).toHaveBeenCalledWith("p1");
  });

  it("answers with ♥ or ✕ on the next frame (after fixing the exit animation) and only once", async () => {
    const { onLike, onPass } = renderCard();

    fireEvent.click(screen.getByLabelText("Dar like a Sergio"));
    fireEvent.click(screen.getByLabelText("Pasar de Sergio"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(32);
    });

    expect(onLike).toHaveBeenCalledWith("p1");
    expect(onPass).not.toHaveBeenCalled();
  });

  it("disables the buttons while an answer is in flight", () => {
    renderCard({ busy: true });
    expect(screen.getByLabelText("Dar like a Sergio")).toBeDisabled();
    expect(screen.getByLabelText("Pasar de Sergio")).toBeDisabled();
  });

  it("hides the shared badge when there is nothing in common", () => {
    renderCard({ like: like({ sharedTagsCount: 0 }) });
    expect(screen.queryByText(/en común/)).not.toBeInTheDocument();
  });
});
