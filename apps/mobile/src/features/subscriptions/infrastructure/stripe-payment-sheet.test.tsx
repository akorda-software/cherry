import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import {
  initPaymentSheetMock,
  presentPaymentSheetMock
} from "../../../../test/mocks/stripe-react-native";
import { RuntimeConfigProvider } from "../../../shared/config";
import { useStripePaymentSheet } from "./stripe-payment-sheet";

function wrapper({ children }: PropsWithChildren) {
  return (
    <RuntimeConfigProvider
      apiBaseUrl="http://localhost:4000"
      bootstrapConfig={{
        features: {},
        services: {
          stripe: {
            publishableKey: "pk_test_123",
            merchantDisplayName: "Snack",
            merchantIdentifier: "merchant.snack",
            urlScheme: "snack"
          }
        }
      }}
      reader={{ isEnabled: () => true }}
      loading={false}
    >
      {children}
    </RuntimeConfigProvider>
  );
}

describe("useStripePaymentSheet", () => {
  it("returns completed when Payment Sheet succeeds", async () => {
    initPaymentSheetMock.mockResolvedValueOnce({ error: undefined });
    presentPaymentSheetMock.mockResolvedValueOnce({ error: undefined });

    const { result } = renderHook(() => useStripePaymentSheet(), { wrapper });
    const checkout = await result.current.presentCheckout({
      customerId: "cus_123",
      customerEphemeralKeySecret: "ek_test_123",
      pendingSubscriptionId: "sub_pending_123",
      paymentIntentClientSecret: "pi_test_secret_123"
    });

    expect(checkout).toEqual({ status: "completed" });
    expect(initPaymentSheetMock).toHaveBeenCalledOnce();
    expect(presentPaymentSheetMock).toHaveBeenCalledOnce();
  });

  it("returns canceled when the user dismisses Payment Sheet", async () => {
    initPaymentSheetMock.mockResolvedValueOnce({ error: undefined });
    presentPaymentSheetMock.mockResolvedValueOnce({
      error: { code: "Canceled", message: "Canceled" }
    });

    const { result } = renderHook(() => useStripePaymentSheet(), { wrapper });
    const checkout = await result.current.presentCheckout({
      customerId: "cus_123",
      customerEphemeralKeySecret: "ek_test_123",
      pendingSubscriptionId: "sub_pending_123",
      paymentIntentClientSecret: "pi_test_secret_123"
    });

    expect(checkout).toEqual({ status: "canceled" });
  });
});
