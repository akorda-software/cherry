import Constants from "expo-constants";

import type { BillingCheckoutResponse, StripeMobileConfig } from "@snack/contracts";

import { useRuntimeConfig } from "../../../shared/config";

export type PaymentSheetResult =
  | { status: "completed" }
  | { status: "canceled" }
  | { status: "failed"; message: string };

type StripePaymentSheetModule = {
  initPaymentSheet?: (options: {
    customerId: string;
    customerEphemeralKeySecret: string;
    paymentIntentClientSecret: string;
    merchantDisplayName: string;
    returnURL?: string;
  }) => Promise<{ error?: { message: string } }>;
  presentPaymentSheet?: () => Promise<{
    error?: { code?: string; message: string };
  }>;
};

let stripeModulePromise: Promise<StripePaymentSheetModule | null> | null = null;

function useSubscriptionStripeRuntimeConfig(): StripeMobileConfig | null {
  const { bootstrapConfig } = useRuntimeConfig();
  return bootstrapConfig?.services?.stripe ?? null;
}

function loadStripePaymentSheetModule() {
  if (Constants.executionEnvironment === "storeClient") {
    return Promise.resolve(null);
  }

  if (stripeModulePromise) {
    return stripeModulePromise;
  }

  stripeModulePromise = import("@stripe/stripe-react-native").then(
    (mod) => mod as StripePaymentSheetModule,
    () => null
  );

  return stripeModulePromise;
}

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

      const stripeModule = await loadStripePaymentSheetModule();

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
