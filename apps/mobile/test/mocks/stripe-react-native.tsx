import type { PropsWithChildren } from "react";
import { vi } from "vitest";

export const initPaymentSheetMock = vi.fn(async () => ({ error: undefined }));
export const presentPaymentSheetMock = vi.fn(async () => ({ error: undefined }));

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
