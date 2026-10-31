import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export function AuthShell({ title, subtitle, footer, children }: {
  title: string; subtitle: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex" style={{ backgroundImage: "var(--gradient-primary)" }}>
        <Link to="/" className="flex items-center">
          <Logo size="md" />
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
            <Link to="/" className="flex items-center">
              <Logo size="sm" />
            </Link>
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
