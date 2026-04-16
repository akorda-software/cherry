import type { PropsWithChildren } from "react";
import { useMemo } from "react";

import { createBillingApi } from "@snack/mobile-shared";

import { useSessionShell } from "../../auth/presentation";
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

    return {
      featureFlagEnabled: enabled,
      fetchPlans: billingApi.fetchPlans,
      getSubscription: billingApi.getSubscription,
      subscribe: billingApi.subscribe,
      abandonPendingSubscription: billingApi.abandonPendingSubscription,
      cancel: billingApi.cancel
    };
  }, [apiBaseUrl, enabled, state]);

  return <SubscriptionShellProvider services={services}>{children}</SubscriptionShellProvider>;
}
