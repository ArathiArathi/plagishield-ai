import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "faculty" | "institution_admin" | "super_admin";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          supabase.from("user_roles").select("role").eq("user_id", s.user.id)
            .then(({ data }) => setRoles((data ?? []).map((r) => r.role as AppRole)));
        }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) {
        supabase.from("user_roles").select("role").eq("user_id", data.session.user.id)
          .then(({ data: rows }) => setRoles((rows ?? []).map((r) => r.role as AppRole)));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session, user, roles, loading,
    isAuthenticated: !!session,
    hasRole: (r: AppRole) => roles.includes(r),
    hasAnyRole: (rs: AppRole[]) => rs.some((r) => roles.includes(r)),
    signOut: () => supabase.auth.signOut(),
  };
}
