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
import { Check, Sparkles, Zap, ShieldCheck } from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
  useSubscription,
} from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

export function UpgradeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { planId, changePlan, docsUsed } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (targetPlan: SubscriptionPlanId) => {
    if (targetPlan === planId) return;
    setLoadingPlan(targetPlan);
    try {
      await changePlan(targetPlan);
      onOpenChange(false);
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = Object.values(SUBSCRIPTION_PLANS);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-center">
          <Badge variant="outline" className="mx-auto mb-2 w-fit gap-1 border-primary/30 bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Flexible Document Plans
          </Badge>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Upgrade your PlagiShield workspace
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-lg mx-auto mt-1">
            Free tier includes 10 documents. Upgrade to Pro (15 docs), Plus (25 docs), or Premium (35 docs) with priority queue and advanced forensic modules.
          </DialogDescription>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5",
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Annual billing
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-success/20 text-success">
                Save 25%
              </Badge>
            </button>
          </div>
        </DialogHeader>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.id === planId;
            const price = billingCycle === "monthly" ? p.priceMonthly : Math.round(p.priceAnnual / 12);

            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-4.5 transition-all",
                  p.popular
                    ? "border-primary bg-primary/[0.03] shadow-md ring-1 ring-primary"
                    : isCurrent
                      ? "border-border bg-muted/40"
                      : "border-border bg-card hover:border-border/80",
                )}
              >
                {p.popular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                    Most Popular
                  </Badge>
                )}

                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="font-semibold text-foreground text-sm">{p.name}</h3>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        Current
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      ${price}
                    </span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                  {billingCycle === "annual" && p.priceAnnual > 0 && (
                    <p className="text-[11px] text-muted-foreground">Billed ${p.priceAnnual} yearly</p>
                  )}

                  <div className="mt-3.5 rounded-md bg-muted/60 p-2 text-center text-xs">
                    <span className="font-semibold text-foreground text-sm">{p.docLimit}</span>{" "}
                    <span className="text-muted-foreground">documents limit</span>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    variant={isCurrent ? "outline" : p.popular ? "default" : "secondary"}
                    disabled={isCurrent || loadingPlan === p.id}
                    onClick={() => handleSelectPlan(p.id)}
                  >
                    {isCurrent ? "Active plan" : loadingPlan === p.id ? "Updating…" : `Switch to ${p.name}`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Currently using <strong>{docsUsed}</strong> documents. Need an institution-wide custom volume for 100+ documents?</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
