import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
  useSubscription,
} from "@/hooks/use-subscription";
import type { BillingCycle } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

export function UpgradeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    planId,
    changePlan,
    openBillingPortal,
    docsUsed,
    hasBillingCustomer,
    subscriptionStatus,
  } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const plans = Object.values(SUBSCRIPTION_PLANS);
  const hasActiveSubscription = ["active", "trialing", "past_due", "unpaid"].includes(
    subscriptionStatus,
  );

  const handleSelectPlan = async (targetPlan: SubscriptionPlanId) => {
    if (targetPlan === planId || loadingPlan) return;
    setLoadingPlan(targetPlan);
    try {
      const started = await changePlan(targetPlan, billingCycle);
      if (started) onOpenChange(false);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    setLoadingPlan("portal");
    try {
      await openBillingPortal();
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-center">
          <Badge
            variant="outline"
            className="mx-auto mb-2 w-fit gap-1 border-primary/30 bg-primary/10 text-primary"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Secure subscription billing
          </Badge>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Choose the allowance that fits your work
          </DialogTitle>
          <DialogDescription className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Payments are handled on Stripe Checkout. Your plan changes only after Stripe confirms
            the subscription through a verified webhook.
          </DialogDescription>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Annual
              <Badge
                variant="secondary"
                className="bg-success/20 px-1.5 py-0 text-[10px] text-success"
              >
                Annual billing
              </Badge>
            </button>
          </div>
        </DialogHeader>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.id === planId;
            const monthlyEquivalent =
              billingCycle === "monthly" ? p.priceMonthly : Math.round(p.priceAnnual / 12);
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-4 transition-colors",
                  p.popular
                    ? "border-primary bg-primary/[0.03]"
                    : isCurrent
                      ? "border-primary/40 bg-muted/40"
                      : "border-border bg-card hover:border-primary/40",
                )}
              >
                {p.popular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                    Most chosen
                  </Badge>
                )}
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                    {isCurrent && (
                      <Badge
                        variant="secondary"
                        className="border-primary/20 bg-primary/10 text-[10px] text-primary"
                      >
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tracking-tight text-foreground">
                      {p.priceMonthly === 0
                        ? "Free"
                        : `₹${monthlyEquivalent.toLocaleString("en-IN")}`}
                    </span>
                    {p.priceMonthly > 0 && (
                      <span className="text-xs text-muted-foreground">/month</span>
                    )}
                  </div>
                  {billingCycle === "annual" && p.priceAnnual > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Billed ₹{p.priceAnnual.toLocaleString("en-IN")} once a year
                    </p>
                  )}
                  <p className="mt-3 rounded-md bg-muted/60 p-2 text-center text-xs">
                    <strong className="text-sm text-foreground">{p.docLimit}</strong>{" "}
                    <span className="text-muted-foreground">document reviews each month</span>
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    {p.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="leading-5">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5">
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    variant={isCurrent ? "outline" : p.popular ? "default" : "secondary"}
                    disabled={isCurrent || Boolean(loadingPlan) || hasActiveSubscription}
                    onClick={() => handleSelectPlan(p.id)}
                  >
                    {isCurrent
                      ? "Current plan"
                      : loadingPlan === p.id
                        ? "Opening checkout…"
                        : "Continue to checkout"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {hasActiveSubscription
                ? "You already have an active subscription. Use the billing portal to change plans, update payment details, or cancel."
                : `Your workspace currently contains ${docsUsed} documents. Secure checkout opens in a new hosted payment flow.`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasBillingCustomer && (
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(loadingPlan)}
                onClick={handleManageBilling}
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                {loadingPlan === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
        {!hasBillingCustomer && !hasActiveSubscription && (
          <p className="text-center text-[11px] text-muted-foreground">
            Billing is available once the workspace owner has configured Stripe price IDs and
            deployed the billing functions.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
