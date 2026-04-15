import type { PropsWithChildren } from "react";
import { useMemo } from "react";

import { createBillingApi } from "@snack/mobile-shared";

import { useSessionShell } from "../../auth/presentation";
import { createSubscriptionApiAdapter } from "../infrastructure/subscription-api";
import { SubscriptionShellProvider } from "./subscription-shell-provider";
import { useFeatureFlag, useRuntimeConfig } from "../../../shared/config";
import { createJsonHttpClient } from "../../../shared/api";

export function SubscriptionFeatureProvider({ children }: PropsWithChildren) {
  const { state } = useSessionShell();
  const { apiBaseUrl } = useRuntimeConfig();
  const { enabled } = useFeatureFlag("subscriptions");

  const services = useMemo(() => {
    const accessToken = state.status === "signed-in" ? state.session.accessToken : null;

    const httpClient = createJsonHttpClient({
      apiBaseUrl,
      getHeaders: () =>
        accessToken === null
          ? {}
          : {
              Authorization: `Bearer ${accessToken}`
            }
    });

    const billingApi = createBillingApi(httpClient);
    const subscriptionApi = createSubscriptionApiAdapter({ billingApi });

    return {
      featureFlagEnabled: enabled,
      fetchPlans: subscriptionApi.fetchPlans,
      getSubscription: subscriptionApi.getSubscription,
      subscribe: subscriptionApi.subscribe,
      abandonPendingSubscription: subscriptionApi.abandonPendingSubscription,
      cancel: subscriptionApi.cancel
    };
  }, [apiBaseUrl, enabled, state]);

  return <SubscriptionShellProvider services={services}>{children}</SubscriptionShellProvider>;
}
