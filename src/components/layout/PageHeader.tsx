import type { ReactNode } from "react";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between min-w-0">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground break-words [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
