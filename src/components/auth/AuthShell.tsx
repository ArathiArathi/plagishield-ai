import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, footer, children }: {
  title: string; subtitle: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex" style={{ backgroundImage: "var(--gradient-primary)" }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-semibold text-white">PlagiShield AI</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold leading-tight text-white">Plagiarism intelligence for the modern academic.</h2>
          <p className="mt-3 max-w-md text-sm text-white/80">Trusted by universities, publishers, and research institutions to safeguard content authenticity at scale.</p>
        </div>
        <p className="text-xs text-white/60">© 2026 PlagiShield AI</p>
      </div>
      <div className="flex items-center justify-center bg-background p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="font-semibold text-foreground">PlagiShield AI</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
