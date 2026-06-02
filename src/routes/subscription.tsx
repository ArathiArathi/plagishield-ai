import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [{ title: "Subscription — PlagiShield AI" }, { name: "description", content: "Manage plan, billing, and usage." }] }),
  component: SubscriptionPage,
});

const plans = [
  { name: "Free", price: "$0", features: ["5 docs / month", "Basic plagiarism", "Email support"], cta: "Current" },
  { name: "Student", price: "$9", features: ["50 docs / month", "AI detection", "Grammar + citation", "Priority email"], cta: "Upgrade" },
  { name: "Professional", price: "$29", features: ["500 docs / month", "Full reports + exports", "API access", "Chat support"], cta: "Most popular", featured: true },
  { name: "Institution", price: "$99", features: ["5,000 docs / month", "Team management", "Departmental analytics", "Dedicated CSM"], cta: "Talk to sales" },
];

function SubscriptionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Subscription & Billing" description="Manage your plan, billing details, and usage." />

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge>Professional plan</Badge>
            <h3 className="mt-2 text-xl font-semibold text-foreground">$29 / month</h3>
            <p className="text-sm text-muted-foreground">Renews on July 2, 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">Manage billing</Button>
            <Button size="sm">Upgrade plan</Button>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Documents used this month</span><span>1,284 / 5,000</span>
          </div>
          <Progress value={26} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.name} className={cn("relative flex flex-col p-5", p.featured && "border-primary shadow-[var(--shadow-elegant)]")}>
            {p.featured && <Badge className="absolute -top-2.5 left-5 bg-primary text-primary-foreground">Most popular</Badge>}
            <p className="text-sm font-medium text-muted-foreground">{p.name}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{f}</li>
              ))}
            </ul>
            <Button className="mt-5" variant={p.featured ? "default" : "outline"}>{p.cta}</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
