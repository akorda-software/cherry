import type { StripeMobileConfig } from "@snack/contracts";
import type { PropsWithChildren, ReactElement } from "react";
import { useEffect, useState } from "react";
import Constants from "expo-constants";

import { useRuntimeConfig } from "../../../shared/config";
import { SubscriptionFeatureProvider } from "./subscription-feature-provider";

type StripeProviderProps = PropsWithChildren<{
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
}>;

type StripeProviderComponent = (props: StripeProviderProps) => ReactElement;

function isExpoGo() {
  return Constants.executionEnvironment === "storeClient";
}

function SubscriptionStripeProvider({
  children,
  stripeConfig
}: PropsWithChildren<{ stripeConfig: StripeMobileConfig | null }>) {
  const [StripeProviderComponent, setStripeProviderComponent] = useState<StripeProviderComponent | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    if (stripeConfig === null || isExpoGo()) {
      setStripeProviderComponent(null);
      return () => {
        cancelled = true;
      };
    }

    void import("@stripe/stripe-react-native").then(
      (mod) => {
        if (cancelled) {
          return;
        }

        setStripeProviderComponent(() => mod.StripeProvider as StripeProviderComponent);
      },
      () => {
        if (cancelled) {
          return;
        }

        setStripeProviderComponent(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [stripeConfig]);

  if (stripeConfig === null || StripeProviderComponent === null) {
    return <>{children}</>;
  }

  return (
    <StripeProviderComponent
      publishableKey={stripeConfig.publishableKey}
      merchantIdentifier={stripeConfig.merchantIdentifier}
      urlScheme={stripeConfig.urlScheme}
    >
      {children}
    </StripeProviderComponent>
  );
}

export function SubscriptionModuleProvider({ children }: PropsWithChildren) {
  const { bootstrapConfig } = useRuntimeConfig();

  return (
    <SubscriptionStripeProvider stripeConfig={bootstrapConfig?.services?.stripe ?? null}>
      <SubscriptionFeatureProvider>{children}</SubscriptionFeatureProvider>
    </SubscriptionStripeProvider>
  );
}
