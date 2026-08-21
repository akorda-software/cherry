import type { PropsWithChildren } from "react";
import { vi } from "vitest";

type StripeSheetError = { code?: string; message: string } | undefined;

export const initPaymentSheetMock = vi.fn(async () => ({ error: undefined as StripeSheetError }));
export const presentPaymentSheetMock = vi.fn(async () => ({ error: undefined as StripeSheetError }));

export function StripeProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function useStripe() {
  return {
    initPaymentSheet: initPaymentSheetMock,
    presentPaymentSheet: presentPaymentSheetMock
  };
}

export const initPaymentSheet = initPaymentSheetMock;
export const presentPaymentSheet = presentPaymentSheetMock;
