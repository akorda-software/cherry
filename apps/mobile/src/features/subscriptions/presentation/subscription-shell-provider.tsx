import type { BillingCheckoutResponse, Plan, Subscription } from "@snack/contracts";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type SubscriptionShellState =
  | { status: "loading"; subscription: null; plans: Plan[]; error: null }
  | { status: "subscribed"; subscription: Subscription; plans: Plan[]; error: null }
  | { status: "unsubscribed"; subscription: null; plans: Plan[]; error: null }
  | { status: "error"; subscription: null; plans: Plan[]; error: string }
  | { status: "disabled"; subscription: null; plans: Plan[]; error: null };

export interface SubscriptionShellServices {
  featureFlagEnabled: boolean;
  fetchPlans(): Promise<Plan[]>;
  getSubscription(): Promise<{ subscribed: boolean; subscription?: Subscription }>;
  subscribe(planId: string): Promise<BillingCheckoutResponse>;
  abandonPendingSubscription(pendingSubscriptionId: string): Promise<{ status: string }>;
  cancel(): Promise<{ status: string }>;
}

interface SubscriptionShellContextValue {
  state: SubscriptionShellState;
  subscribeToPlan(planId: string): Promise<BillingCheckoutResponse>;
  abandonPendingCheckout(pendingSubscriptionId: string): Promise<void>;
  cancelSubscription(): Promise<void>;
  refresh(): Promise<void>;
}

const SubscriptionShellContext = createContext<SubscriptionShellContextValue | null>(null);

export function SubscriptionShellProvider({
  children,
  services
}: PropsWithChildren<{ services: SubscriptionShellServices }>) {
  const [state, setState] = useState<SubscriptionShellState>({
    status: "loading",
    subscription: null,
    plans: [],
    error: null
  });

  const loadSubscriptionData = useCallback(async () => {
    if (!services.featureFlagEnabled) {
      setState({ status: "disabled", subscription: null, plans: [], error: null });
      return;
    }

    try {
      const [plans, subscriptionResult] = await Promise.all([
        services.fetchPlans(),
        services.getSubscription()
      ]);

      if (subscriptionResult.subscribed && subscriptionResult.subscription) {
        setState({
          status: "subscribed",
          subscription: subscriptionResult.subscription,
          plans,
          error: null
        });
      } else {
        setState({
          status: "unsubscribed",
          subscription: null,
          plans,
          error: null
        });
      }
    } catch (error) {
      setState({
        status: "error",
        subscription: null,
        plans: [],
        error: error instanceof Error ? error.message : "Failed to load subscription data"
      });
    }
  }, [services]);

  useEffect(() => {
    void loadSubscriptionData();
  }, [loadSubscriptionData]);

  const subscribeToPlan = useCallback(
    async (planId: string) => {
      return services.subscribe(planId);
    },
    [services]
  );

  const cancelSubscription = useCallback(async () => {
    await services.cancel();
    await loadSubscriptionData();
  }, [services, loadSubscriptionData]);

  const abandonPendingCheckout = useCallback(
    async (pendingSubscriptionId: string) => {
      await services.abandonPendingSubscription(pendingSubscriptionId);
      await loadSubscriptionData();
    },
    [services, loadSubscriptionData]
  );

  const refresh = useCallback(async () => {
    await loadSubscriptionData();
  }, [loadSubscriptionData]);

  const value = useMemo(
    () => ({ state, subscribeToPlan, abandonPendingCheckout, cancelSubscription, refresh }),
    [state, subscribeToPlan, abandonPendingCheckout, cancelSubscription, refresh]
  );

  return (
    <SubscriptionShellContext.Provider value={value}>{children}</SubscriptionShellContext.Provider>
  );
}

export function useSubscriptionShell() {
  const context = useContext(SubscriptionShellContext);

  if (context === null) {
    throw new Error("useSubscriptionShell must be used within SubscriptionShellProvider");
  }

  return context;
}
