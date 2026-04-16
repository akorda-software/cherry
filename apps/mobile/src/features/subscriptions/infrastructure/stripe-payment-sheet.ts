import type { BillingCheckoutResponse } from "@snack/contracts";

import {
  loadStripeRuntimeModule,
  useSubscriptionStripeRuntimeConfig
} from "./stripe-runtime";

export type PaymentSheetResult =
  | { status: "completed" }
  | { status: "canceled" }
  | { status: "failed"; message: string };

export function useStripePaymentSheet() {
  const stripeConfig = useSubscriptionStripeRuntimeConfig();

  return {
    async presentCheckout(session: BillingCheckoutResponse): Promise<PaymentSheetResult> {
      if (stripeConfig === null) {
        return {
          status: "failed",
          message: "Stripe is not configured for this app"
        };
      }

      const stripeModule = await loadStripeRuntimeModule();

      if (!stripeModule?.initPaymentSheet || !stripeModule.presentPaymentSheet) {
        return {
          status: "failed",
          message: "Stripe PaymentSheet is not available in this build (use a development build, not Expo Go)"
        };
      }

      const initResult = await stripeModule.initPaymentSheet({
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

      const presentResult = await stripeModule.presentPaymentSheet();

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
