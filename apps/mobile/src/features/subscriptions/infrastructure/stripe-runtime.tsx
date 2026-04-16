import type { StripeMobileConfig } from "@snack/contracts";
import type { PropsWithChildren, ReactElement } from "react";
import { useEffect, useState } from "react";
import Constants from "expo-constants";

import { useRuntimeConfig } from "../../../shared/config";

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
}>;

type StripeProviderComponent = (props: StripeProviderProps) => ReactElement;

export type StripeRuntimeModule = {
  StripeProvider?: StripeProviderComponent;
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

let stripeRuntimeModulePromise: Promise<StripeRuntimeModule | null> | null = null;

export function useSubscriptionStripeRuntimeConfig(): StripeMobileConfig | null {
  const { bootstrapConfig } = useRuntimeConfig();
  return bootstrapConfig?.services?.stripe ?? null;
}

export function loadStripeRuntimeModule() {
  if (Constants.executionEnvironment === "storeClient") {
    return Promise.resolve(null);
  }

  if (stripeRuntimeModulePromise) {
    return stripeRuntimeModulePromise;
  }

  stripeRuntimeModulePromise = import("@stripe/stripe-react-native").then(
    (mod) => mod as StripeRuntimeModule,
    () => null
  );

  return stripeRuntimeModulePromise;
}

export function SubscriptionStripeProvider({
  children,
  stripeConfig
}: PropsWithChildren<{ stripeConfig: StripeMobileConfig | null }>) {
  const [StripeProvider, setStripeProvider] = useState<StripeProviderComponent | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (stripeConfig === null) {
      setStripeProvider(null);
      return () => {
        cancelled = true;
      };
    }

    void loadStripeRuntimeModule().then((mod) => {
      if (cancelled) {
        return;
      }

      setStripeProvider(() => mod?.StripeProvider ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [stripeConfig]);

  if (stripeConfig === null || StripeProvider === null) {
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={stripeConfig.publishableKey}
      merchantIdentifier={stripeConfig.merchantIdentifier}
      urlScheme={stripeConfig.urlScheme}
    >
      {children}
    </StripeProvider>
  );
}
