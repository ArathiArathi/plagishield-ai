import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { toast } from "sonner";

export type SubscriptionPlanId = "free" | "pro" | "plus" | "premium";
export type BillingCycle = "monthly" | "annual";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  docLimit: number;
  priceMonthly: number;
  priceAnnual: number;
  badge?: string;
  popular?: boolean;
  features: string[];
};

const commonFeatures = [
  "Evidence-backed text similarity review",
  "AI-style writing signals with clear limitations",
  "Grammar and citation review",
  "Downloadable review reports",
];

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free",
    docLimit: 10,
    priceMonthly: 0,
    priceAnnual: 0,
    features: [...commonFeatures, "10 document allowance"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    docLimit: 15,
    priceMonthly: 14,
    priceAnnual: 120,
    badge: "For regular use",
    popular: true,
    features: [...commonFeatures, "15 document allowance"],
  },
  plus: {
    id: "plus",
    name: "Plus",
    docLimit: 25,
    priceMonthly: 29,
    priceAnnual: 240,
    badge: "For research projects",
    features: [...commonFeatures, "25 document allowance"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    docLimit: 35,
    priceMonthly: 49,
    priceAnnual: 420,
    badge: "Highest allowance",
    features: [...commonFeatures, "35 document allowance"],
  },
};

type SubscriptionRecord = {
  plan_id: SubscriptionPlanId;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const BILLING_PORTAL_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

async function invokeBillingFunction(name: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const response = (error as Error & { context?: Response }).context;
    const payload = response ? await response.clone().json().catch(() => null) : null;
    throw new Error(payload?.error ?? error.message);
  }
  return data as { url?: string } | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const { data: wsData } = useWorkspaceData();
  const [record, setRecord] = useState<SubscriptionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setRecord(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan_id,status,stripe_customer_id,current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Unable to load subscription:", error);
      toast.error("Your billing status could not be loaded. Please refresh the page.");
      setRecord(null);
    } else {
      setRecord(data as SubscriptionRecord | null);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void refreshSubscription();
    const refreshOnFocus = () => void refreshSubscription();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refreshSubscription]);

  const planId: SubscriptionPlanId =
    record && ACTIVE_STATUSES.has(record.status) && SUBSCRIPTION_PLANS[record.plan_id]
      ? record.plan_id
      : "free";
  const plan = SUBSCRIPTION_PLANS[planId];
  const docsUsed = wsData?.summaryStats?.totalDocuments ?? (wsData?.documents ?? []).length;
  const docLimit = plan.docLimit;
  const isLimitReached = docsUsed >= docLimit;
  const remainingDocs = Math.max(0, docLimit - docsUsed);
  const usagePercent = Math.min(100, Math.round((docsUsed / docLimit) * 100));
  const hasBillingCustomer = Boolean(record?.stripe_customer_id);

  const openBillingPortal = useCallback(async () => {
    try {
      const data = await invokeBillingFunction("create-customer-portal");
      if (!data?.url) throw new Error("The billing portal did not return a link.");
      window.location.assign(data.url);
      return true;
    } catch (error) {
      console.error("Unable to open billing portal:", error);
      toast.error(error instanceof Error ? error.message : "Unable to open billing settings.");
      return false;
    }
  }, []);

  const changePlan = useCallback(async (newPlan: SubscriptionPlanId, billingCycle: BillingCycle = "monthly") => {
    if (!SUBSCRIPTION_PLANS[newPlan]) return false;
    if (newPlan === "free" || (record && BILLING_PORTAL_STATUSES.has(record.status))) {
      return openBillingPortal();
    }

    try {
      const data = await invokeBillingFunction("create-checkout-session", { planId: newPlan, billingCycle });
      if (!data?.url) throw new Error("Checkout is not configured yet. Please contact the workspace administrator.");
      window.location.assign(data.url);
      return true;
    } catch (error) {
      console.error("Unable to start checkout:", error);
      toast.error(error instanceof Error ? error.message : "Unable to start checkout. Please try again.");
      return false;
    }
  }, [openBillingPortal, record]);

  return {
    planId,
    plan,
    docLimit,
    docsUsed,
    isLimitReached,
    remainingDocs,
    usagePercent,
    isLoading,
    subscriptionStatus: record?.status ?? "inactive",
    currentPeriodEnd: record?.current_period_end ?? null,
    hasBillingCustomer,
    refreshSubscription,
    changePlan,
    openBillingPortal,
  };
}
