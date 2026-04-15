import { useStripe } from "@stripe/stripe-react-native";

import type { BillingCheckoutResponse } from "@snack/contracts";

import { useStripeRuntimeConfig } from "../../../shared/config";

export type PaymentSheetResult =
  | { status: "completed" }
  | { status: "canceled" }
  | { status: "failed"; message: string };

export function useStripePaymentSheet() {
  const stripeConfig = useStripeRuntimeConfig();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return {
    async presentCheckout(session: BillingCheckoutResponse): Promise<PaymentSheetResult> {
      if (stripeConfig === null) {
        return {
          status: "failed",
          message: "Stripe is not configured for this app"
        };
      }

      const initResult = await initPaymentSheet({
        customerId: session.customerId,
        customerEphemeralKeySecret: session.customerEphemeralKeySecret,
        paymentIntentClientSecret: session.paymentIntentClientSecret,
        merchantDisplayName: stripeConfig.merchantDisplayName,
        returnURL: stripeConfig.urlScheme ? `${stripeConfig.urlScheme}://stripe-redirect` : undefined
      });

      if (initResult.error) {
        return {
          status: "failed",
          message: initResult.error.message
        };
      }

      const presentResult = await presentPaymentSheet();

      if (!presentResult.error) {
        return { status: "completed" };
      }

      if (presentResult.error.code === "Canceled") {
        return { status: "canceled" };
      }

      return {
        status: "failed",
        message: presentResult.error.message
      };
    }
  };
}
