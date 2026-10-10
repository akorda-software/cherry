import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RelationshipIntent } from "@cherry/contracts";

import { renderWithTheme } from "../../../../../test/ui/render-with-theme";
import { useStepCtaStore } from "../../application/step-cta-store";
import { INTENT_OPTIONS } from "../fields/profile-options";
import { MultiChoiceStep } from "./multi-choice-step";

const goNext = vi.fn();

vi.mock("../use-onboarding-navigation", () => ({
  useOnboardingNavigation: () => ({ goNext })
}));

// The page chrome (paper, frame) is not what this test is about.
vi.mock("../step-page", () => ({
  StepPage: ({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  )
}));

afterEach(() => {
  useStepCtaStore.setState({ byStep: {} });
  goNext.mockReset();
});

function renderStep(saved: RelationshipIntent[] | undefined, save = vi.fn(async (_values: RelationshipIntent[]) => {})) {
  renderWithTheme(
    <MultiChoiceStep<RelationshipIntent>
      options={INTENT_OPTIONS}
      ready
      save={save}
      saved={saved}
      step="intent"
      subtitle="Puedes elegir varias."
      testID="onboarding-intent"
      title="¿Qué buscas?"
    />
  );
  return save;
}

const cta = () => useStepCtaStore.getState().byStep.intent;

describe("MultiChoiceStep", () => {
  it("toggles several options as checkboxes and saves them in option order", async () => {
    const save = renderStep([]);

    expect(cta()).toMatchObject({ enabled: false, hint: "Elige al menos una" });

    fireEvent.click(screen.getByTestId("onboarding-intent-meet_people"));
    fireEvent.click(screen.getByTestId("onboarding-intent-relationship"));

    expect(screen.getByTestId("onboarding-intent-relationship")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("onboarding-intent-casual")).toHaveAttribute("aria-checked", "false");
    expect(cta()).toMatchObject({ enabled: true, hint: null });

    await act(async () => cta()?.onPress());

    await waitFor(() => expect(save).toHaveBeenCalledWith(["relationship", "meet_people"]));
    expect(goNext).toHaveBeenCalledWith("intent");
  });

  it("untoggling the last option disables the CTA again", () => {
    renderStep([]);

    fireEvent.click(screen.getByTestId("onboarding-intent-casual"));
    expect(cta()?.enabled).toBe(true);

    fireEvent.click(screen.getByTestId("onboarding-intent-casual"));
    expect(cta()?.enabled).toBe(false);
  });

  it("starts from the saved choice and skips saving when nothing changed", async () => {
    const save = renderStep(["casual", "go_with_the_flow"]);

    expect(screen.getByTestId("onboarding-intent-casual")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("onboarding-intent-go_with_the_flow")).toHaveAttribute("aria-checked", "true");

    await act(async () => cta()?.onPress());

    await waitFor(() => expect(goNext).toHaveBeenCalledWith("intent"));
    expect(save).not.toHaveBeenCalled();
  });
});
