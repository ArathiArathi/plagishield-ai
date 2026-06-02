import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, suffix, icon: Icon, delta, tone = "primary",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  delta?: number;
  tone?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="p-5 hover:shadow-[var(--shadow-elegant)] transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
            {suffix && <span className="ml-0.5 text-lg font-medium text-muted-foreground">{suffix}</span>}
          </p>
          {typeof delta === "number" && (
            <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium",
              positive ? "text-success" : "text-destructive")}>
              {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta)}% vs last month
            </div>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
