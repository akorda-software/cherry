import { describe, expect, it, vi } from "vitest";

import type { ProfileApi } from "@snack/mobile-shared";

import { apiError, makePreferences, makeProfile } from "../testing/fixtures";
import {
  completeOnboarding,
  saveBio,
  saveDisplayName,
  saveInterested,
  StepValidationError,
  stepSaveErrorMessage,
  type StepApi
} from "./step-actions";

const NOW = new Date("2026-09-29T12:00:00Z");

function fakeApi(overrides: Partial<StepApi> = {}): StepApi {
  return {
    getProfile: vi.fn(async () => ({ profile: makeProfile(), completeness: true })),
    updateProfile: vi.fn(async (fields) => ({ profile: makeProfile(fields as never) })),
    updateDiscoveryPreferences: vi.fn(async (fields) => ({
      discoveryPreferences: makePreferences(fields)
    })),
    completeProfile: vi.fn(async () => ({ profile: makeProfile({ isComplete: true }), onboardingRequired: false })),
    ...overrides
  } as StepApi;
}

describe("step savers", () => {
  it("saves the normalized name (creating the draft)", async () => {
    const api = fakeApi();
    await saveDisplayName(api, "  Lucía   María ");
    expect(api.updateProfile).toHaveBeenCalledWith({ displayName: "Lucía María" });
  });

  it("refuses an empty name without calling the API", async () => {
    const api = fakeApi();
    await expect(saveDisplayName(api, "   ")).rejects.toBeInstanceOf(StepValidationError);
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it("saves a trimmed bio and validates its length", async () => {
    const api = fakeApi();
    await saveBio(api, "  Me ganas si me invitas a churros.  ");
    expect(api.updateProfile).toHaveBeenCalledWith({ bio: "Me ganas si me invitas a churros." });
    await expect(saveBio(api, "corta")).rejects.toThrow("al menos 20");
  });

  it("creates smart discovery defaults with the interested flags", async () => {
    const api = fakeApi();
    await saveInterested(api, { existing: null, interested: ["women"], age: 30 });
    expect(api.updateDiscoveryPreferences).toHaveBeenCalledWith({
      ageMin: 24,
      ageMax: 38,
      distanceKm: 50,
      expandDistance: true,
      discoveryMode: "swipe",
      showMen: false,
      showWomen: true,
      showNonBinary: false
    });
  });

  it("requires at least one interested option", async () => {
    await expect(saveInterested(fakeApi(), { existing: null, interested: [], age: 30 })).rejects.toBeInstanceOf(
      StepValidationError
    );
  });
});

describe("stepSaveErrorMessage", () => {
  it("translates 422 validation errors per field", () => {
    expect(stepSaveErrorMessage(apiError(422, { errors: { bio: ["should be at least 20 character(s)"] } }))).toMatch(
      /entre 20 y 240/
    );
    expect(stepSaveErrorMessage(apiError(422, { errors: { birth_date: ["is invalid"] } }))).toMatch(/fecha/);
  });

  it("falls back to friendly network/server messages", () => {
    expect(stepSaveErrorMessage(apiError(500, {}))).toMatch(/por nuestra parte/);
    expect(stepSaveErrorMessage(new TypeError("Network request failed"))).toMatch(/conexión/);
    expect(stepSaveErrorMessage(new StepValidationError("Dinos cómo te llamas."))).toBe("Dinos cómo te llamas.");
  });
});

describe("completeOnboarding", () => {
  it("confirms a complete profile", async () => {
    const api = fakeApi();
    const result = await completeOnboarding(api, NOW);
    expect(result.status).toBe("completed");
    expect(api.completeProfile).toHaveBeenCalledOnce();
  });

  it("does not confirm when the flow rules are not met (e.g. non-strict backend without photos)", async () => {
    const api = fakeApi({
      getProfile: vi.fn(async () => ({ profile: makeProfile({ photos: [] }), completeness: true }))
    });
    await expect(completeOnboarding(api, NOW)).resolves.toEqual({ status: "incomplete", step: "photos", missing: [] });
    expect(api.completeProfile).not.toHaveBeenCalled();
  });

  it("maps profile_incomplete.missing[] to the first step of the flow", async () => {
    const api = fakeApi({
      completeProfile: vi.fn(async () => {
        throw apiError(422, {
          error: "profile_incomplete",
          missing: ["bio", "interested_in", "location"],
          nextOnboardingStep: "bio"
        });
      })
    });
    await expect(completeOnboarding(api, NOW)).resolves.toEqual({
      status: "incomplete",
      step: "interested",
      missing: ["bio", "interested_in", "location"]
    });
  });

  it("uses nextOnboardingStep when missing[] is empty and sends a missing profile to name", async () => {
    const withHint = fakeApi({
      completeProfile: vi.fn(async () => {
        throw apiError(422, { error: "profile_incomplete", missing: [], nextOnboardingStep: "tags" });
      })
    });
    await expect(completeOnboarding(withHint, NOW)).resolves.toMatchObject({ status: "incomplete", step: "tags" });

    const noProfile = fakeApi({
      completeProfile: vi.fn(async () => {
        throw apiError(404, { error: "profile_not_found" });
      })
    });
    await expect(completeOnboarding(noProfile, NOW)).resolves.toMatchObject({ status: "incomplete", step: "name" });
  });

  it("rethrows other errors (network, 500)", async () => {
    const api = fakeApi({
      completeProfile: vi.fn(async () => {
        throw apiError(500, {});
      })
    });
    await expect(completeOnboarding(api, NOW)).rejects.toMatchObject({ status: 500 });
  });

  it("goes to name when the profile does not exist", async () => {
    const api = fakeApi({ getProfile: vi.fn(async () => ({ profile: null, completeness: false })) });
    await expect(completeOnboarding(api, NOW)).resolves.toMatchObject({ status: "incomplete", step: "name" });
  });
});

// Asegura que el fake cumple la parte de ProfileApi que usan los pasos.
const _typecheck: StepApi = {} as Pick<
  ProfileApi,
  "getProfile" | "updateProfile" | "updateDiscoveryPreferences" | "completeProfile"
>;
void _typecheck;
