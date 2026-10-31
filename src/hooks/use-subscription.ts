import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { toast } from "sonner";

export type SubscriptionPlanId = "free" | "pro" | "plus" | "premium";

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

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free Plan",
    docLimit: 10,
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      "10 document analyses included",
      "Plagiarism & web source matching",
      "AI stylometric content detection",
      "Grammar & language diagnostics",
      "Standard queue processing",
      "Standard PDF report export",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro Plan",
    docLimit: 15,
    priceMonthly: 14,
    priceAnnual: 120,
    badge: "Popular for Students",
    popular: true,
    features: [
      "15 document analyses included",
      "Priority analysis queue",
      "Crossref & OpenAlex deep retrieval",
      "Sentence-level AI probability breakdown",
      "Picky grammar & style suggestions",
      "Visual chart exports in PDF",
    ],
  },
  plus: {
    id: "plus",
    name: "Plus Plan",
    docLimit: 25,
    priceMonthly: 29,
    priceAnnual: 240,
    badge: "For Faculty & Researchers",
    features: [
      "25 document analyses included",
      "Instant parallel queue processing",
      "Crossref DOI bibliographic verification",
      "Full LLM forensic reasoning breakdown",
      "Multi-module institutional dossier exports",
      "Priority customer support",
    ],
  },
  premium: {
    id: "premium",
    name: "Premium Plan",
    docLimit: 35,
    priceMonthly: 49,
    priceAnnual: 420,
    badge: "Institutional Grade",
    features: [
      "35 document analyses included",
      "Unlimited version comparisons",
      "Academic IEEE / ACM formatted PDF reports",
      "Dedicated worker queue with zero latency",
      "Team & departmental collaboration",
      "Dedicated account manager & 24/7 SLA",
    ],
  },
};

const PLAN_STORAGE_KEY = "plagishield_user_plan";

export function useSubscription() {
  const { user } = useAuth();
  const { data: wsData } = useWorkspaceData();

  const [planId, setPlanId] = useState<SubscriptionPlanId>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PLAN_STORAGE_KEY) as SubscriptionPlanId | null;
      if (stored && SUBSCRIPTION_PLANS[stored]) return stored;
    }
    const metaPlan = user?.user_metadata?.plan as SubscriptionPlanId | undefined;
    return metaPlan && SUBSCRIPTION_PLANS[metaPlan] ? metaPlan : "free";
  });

  // Sync when user changes
  useEffect(() => {
    if (user?.user_metadata?.plan) {
      const p = user.user_metadata.plan as SubscriptionPlanId;
      if (SUBSCRIPTION_PLANS[p]) {
        setPlanId(p);
        localStorage.setItem(PLAN_STORAGE_KEY, p);
      }
    }
  }, [user]);

  const plan = SUBSCRIPTION_PLANS[planId] ?? SUBSCRIPTION_PLANS.free;
  const docsUsed = wsData?.summaryStats?.totalDocuments ?? (wsData?.documents ?? []).length;
  const docLimit = plan.docLimit;
  const isLimitReached = docsUsed >= docLimit;
  const remainingDocs = Math.max(0, docLimit - docsUsed);
  const usagePercent = Math.min(100, Math.round((docsUsed / docLimit) * 100));

  const changePlan = useCallback(
    async (newPlan: SubscriptionPlanId) => {
      if (!SUBSCRIPTION_PLANS[newPlan]) return;
      try {
        setPlanId(newPlan);
        if (typeof window !== "undefined") {
          localStorage.setItem(PLAN_STORAGE_KEY, newPlan);
        }
        if (user) {
          await supabase.auth.updateUser({
            data: { plan: newPlan },
          });
        }
        toast.success(`Successfully switched to ${SUBSCRIPTION_PLANS[newPlan].name}! Limit updated to ${SUBSCRIPTION_PLANS[newPlan].docLimit} documents.`);
      } catch (err) {
        console.error("Failed to update plan:", err);
        toast.error("Could not update plan. Please try again.");
      }
    },
    [user],
  );

  return {
    planId,
    plan,
    docLimit,
    docsUsed,
    isLimitReached,
    remainingDocs,
    usagePercent,
    changePlan,
  };
}
