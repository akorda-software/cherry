import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useStepCta, useStepCtaStore } from "./step-cta-store";

afterEach(() => {
  useStepCtaStore.setState({ byStep: {} });
});

describe("useStepCta", () => {
  it("registers the step CTA and removes it on unmount", () => {
    const onPress = vi.fn();
    const { unmount } = renderHook(() => useStepCta("bio", { enabled: true, onPress, hint: "Te faltan 3" }));

    const cta = useStepCtaStore.getState().byStep.bio;
    expect(cta).toMatchObject({ label: "Continuar", enabled: true, busy: false, hint: "Te faltan 3", testID: "onboarding-cta-bio" });

    act(() => cta?.onPress());
    expect(onPress).toHaveBeenCalledOnce();

    unmount();
    expect(useStepCtaStore.getState().byStep.bio).toBeUndefined();
  });

  it("always calls the latest handler without re-registering on every render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler }) => useStepCta("name", { enabled: true, onPress: handler }), {
      initialProps: { handler: first }
    });
    const registered = useStepCtaStore.getState().byStep.name;

    rerender({ handler: second });
    expect(useStepCtaStore.getState().byStep.name).toBe(registered);

    act(() => registered?.onPress());
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it("re-registers when something visible changes (busy, label, secondary)", () => {
    const { rerender } = renderHook(({ busy }) => useStepCta("location", { enabled: true, busy, onPress: vi.fn(), secondary: busy ? null : { label: "Ya está", onPress: vi.fn() } }), {
      initialProps: { busy: false }
    });
    expect(useStepCtaStore.getState().byStep.location?.secondary?.label).toBe("Ya está");

    rerender({ busy: true });
    expect(useStepCtaStore.getState().byStep.location).toMatchObject({ busy: true, secondary: null });
  });
});
