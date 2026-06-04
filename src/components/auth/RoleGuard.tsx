import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/": ["student", "faculty", "institution_admin", "super_admin"],
  "/documents": ["student", "faculty", "institution_admin", "super_admin"],
  "/analysis": ["student", "faculty", "institution_admin", "super_admin"],
  "/reports": ["student", "faculty", "institution_admin", "super_admin"],
  "/analytics": ["faculty", "institution_admin", "super_admin"],
  "/repository": ["faculty", "institution_admin", "super_admin"],
  "/team": ["institution_admin", "super_admin"],
  "/subscription": ["institution_admin", "super_admin"],
  "/settings": ["student", "faculty", "institution_admin", "super_admin"],
};

export function RoleGuard({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { roles, loading } = useAuth();
  const required = ROUTE_ROLES[pathname];
  if (!required) return <>{children}</>;
  if (loading) return null;
  const allowed = roles.some((r) => required.includes(r));
  if (allowed) return <>{children}</>;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Access restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role doesn't have permission to view this page. Allowed roles: {required.join(", ")}.
        </p>
        <Button asChild className="mt-5" size="sm"><Link to="/">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
