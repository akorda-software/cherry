import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileApi } from "@cherry/mobile-shared";

import { renderWithTheme } from "../../../../../test/ui/render-with-theme";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { useStepCtaStore } from "../../application/step-cta-store";
import { makeProfile } from "../../testing/fixtures";
import { BioStep } from "./bio-step";

const { updateProfile, goNext, draft } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  goNext: vi.fn(),
  draft: { ready: true, profile: null as ReturnType<typeof makeProfile> | null }
}));

vi.mock("../use-profile-draft", () => ({
  useProfileDraft: () => ({
    ...draft,
    callApi: <T,>(run: (api: ProfileApi) => Promise<T>) => run({ updateProfile } as unknown as ProfileApi)
  })
}));
vi.mock("../use-onboarding-navigation", () => ({ useOnboardingNavigation: () => ({ goNext }) }));
vi.mock("../step-page", () => ({
  StepPage: ({ title, children }: { title: string; children: ReactNode }) => <div><h1>{title}</h1>{children}</div>
}));

beforeEach(() => {
  draft.ready = true;
  draft.profile = makeProfile({ bio: "" });
  updateProfile.mockReset();
  goNext.mockReset();
});
afterEach(() => {
  useStepCtaStore.setState({ byStep: {} });
  useProfileDraftStore.getState().reset();
});

const cta = () => useStepCtaStore.getState().byStep.bio;

describe("BioStep", () => {
  it("keeps the CTA stable while typing and saves the latest text, not an old closure", async () => {
    const saved = makeProfile({ bio: "Mi descripción nueva y completa." });
    updateProfile.mockResolvedValue({ profile: saved });
    renderWithTheme(<BioStep />);

    expect(cta()?.enabled).toBe(false);
    fireEvent.change(screen.getByTestId("onboarding-bio-input"), { target: { value: "Una descripción que ya es válida." } });
    const registered = cta();
    expect(registered?.enabled).toBe(true);
    fireEvent.change(screen.getByTestId("onboarding-bio-input"), { target: { value: `  ${saved.bio}  ` } });
    expect(cta()).toBe(registered);

    await act(async () => registered?.onPress());

    expect(updateProfile).toHaveBeenCalledExactlyOnceWith({ bio: saved.bio });
    expect(useProfileDraftStore.getState().profile).toBe(saved);
    expect(goNext).toHaveBeenCalledExactlyOnceWith("bio");
  });

  it("locks the submitted draft and deduplicates double taps during a slow save", async () => {
    let resolve!: (value: { profile: ReturnType<typeof makeProfile> }) => void;
    updateProfile.mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderWithTheme(<BioStep />);
    const text = "Una descripción suficientemente larga.";
    fireEvent.change(screen.getByTestId("onboarding-bio-input"), { target: { value: text } });

    act(() => { cta()?.onPress(); cta()?.onPress(); });
    await waitFor(() => expect(cta()?.busy).toBe(true));
    expect(screen.getByTestId("onboarding-bio-input")).toHaveAttribute("readonly");
    expect(updateProfile).toHaveBeenCalledOnce();

    await act(async () => resolve({ profile: makeProfile({ bio: text }) }));
    expect(goNext).toHaveBeenCalledOnce();
  });

  it("keeps the draft on failure and lets the user edit and retry", async () => {
    updateProfile.mockRejectedValueOnce(new Error("Offline"));
    renderWithTheme(<BioStep />);
    const first = "Mi descripción antes del error.";
    fireEvent.change(screen.getByTestId("onboarding-bio-input"), { target: { value: first } });
    await act(async () => cta()?.onPress());

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-bio-input")).toHaveValue(first);
    expect(screen.getByTestId("onboarding-bio-input")).not.toHaveAttribute("readonly");
    expect(goNext).not.toHaveBeenCalled();

    const next = "Mi descripción después del error.";
    updateProfile.mockResolvedValue({ profile: makeProfile({ bio: next }) });
    fireEvent.change(screen.getByTestId("onboarding-bio-input"), { target: { value: next } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => cta()?.onPress());
    expect(updateProfile).toHaveBeenLastCalledWith({ bio: next });
    expect(goNext).toHaveBeenCalledOnce();
  });

  it("skips a redundant save when the trimmed bio has not changed", async () => {
    draft.profile = makeProfile();
    renderWithTheme(<BioStep />);
    await act(async () => cta()?.onPress());
    expect(updateProfile).not.toHaveBeenCalled();
    expect(goNext).toHaveBeenCalledOnce();
  });
});
