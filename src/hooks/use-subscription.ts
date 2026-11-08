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
    features: [...commonFeatures, "10 document reviews each month"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    docLimit: 15,
    priceMonthly: 1300,
    priceAnnual: 11300,
    badge: "For regular use",
    popular: true,
    features: [...commonFeatures, "15 document reviews each month"],
  },
  plus: {
    id: "plus",
    name: "Plus",
    docLimit: 25,
    priceMonthly: 2700,
    priceAnnual: 22600,
    badge: "For research projects",
    features: [...commonFeatures, "25 document reviews each month"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    docLimit: 35,
    priceMonthly: 4600,
    priceAnnual: 39500,
    badge: "Highest allowance",
    features: [...commonFeatures, "35 document reviews each month"],
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
const DEMO_STORAGE_KEY_PREFIX = "plagishield_demo_subscription_";

function getDemoSubscription(userId: string): SubscriptionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${DEMO_STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.plan_id && parsed.status === "active") {
      return parsed as SubscriptionRecord;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

function setDemoSubscription(userId: string, record: SubscriptionRecord | null) {
  if (typeof window === "undefined") return;
  try {
    if (!record) {
      localStorage.removeItem(`${DEMO_STORAGE_KEY_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${DEMO_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(record));
    }
  } catch {
    // Ignore storage errors
  }
}

async function invokeBillingFunction(name: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const response = (error as Error & { context?: Response }).context;
    const payload = response
      ? await response
          .clone()
          .json()
          .catch(() => null)
      : null;
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
    let subData: SubscriptionRecord | null = null;
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_id,status,stripe_customer_id,current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data && data.status === "active") {
        subData = data as SubscriptionRecord;
      }
    } catch {
      // Ignore Supabase load failure
    }

    if (!subData) {
      subData = getDemoSubscription(user.id);
    }

    setRecord(subData);
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
  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const docsUsed = (wsData?.documents ?? []).filter(
    (document) => Date.parse(document.created_at) >= monthStart,
  ).length;
  const docLimit = plan.docLimit;
  const isLimitReached = docsUsed >= docLimit;
  const remainingDocs = Math.max(0, docLimit - docsUsed);
  const usagePercent = Math.min(100, Math.round((docsUsed / docLimit) * 100));
  const isDemo = record?.stripe_customer_id?.startsWith("demo_") ?? false;
  const hasBillingCustomer = Boolean(record?.stripe_customer_id && !isDemo);

  const activateDemoPlan = useCallback(
    (newPlan: SubscriptionPlanId, billingCycle: BillingCycle = "monthly") => {
      if (!user) return false;
      const targetPlan = SUBSCRIPTION_PLANS[newPlan] ?? SUBSCRIPTION_PLANS.free;
      if (newPlan === "free") {
        setDemoSubscription(user.id, null);
        setRecord(null);
        toast.success("Switched to Free tier.");
        return true;
      }

      const periodEnd = new Date();
      if (billingCycle === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const demoRecord: SubscriptionRecord = {
        plan_id: newPlan,
        status: "active",
        stripe_customer_id: "demo_cus_sandbox",
        current_period_end: periodEnd.toISOString(),
      };

      setDemoSubscription(user.id, demoRecord);
      setRecord(demoRecord);
      toast.success(
        `🎉 Activated ${targetPlan.name} Plan (Demo Mode)! Monthly allowance is now ${targetPlan.docLimit} documents.`,
      );
      return true;
    },
    [user],
  );

  const openBillingPortal = useCallback(async () => {
    if (isDemo) {
      toast.info("Demo Mode active. You can switch plans or reset back to Free anytime.");
      return true;
    }
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
  }, [isDemo]);

  const changePlan = useCallback(
    async (newPlan: SubscriptionPlanId, billingCycle: BillingCycle = "monthly") => {
      if (!SUBSCRIPTION_PLANS[newPlan]) return false;
      if (newPlan === "free") {
        return activateDemoPlan("free");
      }
      if (record && BILLING_PORTAL_STATUSES.has(record.status) && !isDemo) {
        return openBillingPortal();
      }

      try {
        const data = await invokeBillingFunction("create-checkout-session", {
          planId: newPlan,
          billingCycle,
        });
        if (data?.url) {
          window.location.assign(data.url);
          return true;
        }
      } catch (error) {
        console.warn("Stripe checkout unavailable, falling back to Demo Mode:", error);
      }

      // Automatically fallback to Demo Mode if Stripe is unconfigured or prices are absent
      return activateDemoPlan(newPlan, billingCycle);
    },
    [activateDemoPlan, isDemo, openBillingPortal, record],
  );

  return {
    planId,
    plan,
    docLimit,
    docsUsed,
    isLimitReached,
    remainingDocs,
    usagePercent,
    isLoading,
    isDemo,
    activateDemoPlan,
    subscriptionStatus: record?.status ?? "inactive",
    currentPeriodEnd: record?.current_period_end ?? null,
    hasBillingCustomer,
    refreshSubscription,
    changePlan,
    openBillingPortal,
  };
}
