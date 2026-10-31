import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { secureUserCache } from "@/lib/cache/secure-cache";

export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  institution: string;
  avatar_url: string | null;
  role: "student" | "faculty" | "institution_admin" | "super_admin";
  email: string;
};

export function useUserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;

      return secureUserCache.getOrFetch<UserProfile>(
        "profile_and_role",
        async () => {
          // 1. Fetch profile
          const { data: profileData, error: profileErr } = await supabase
            .from("profiles")
            .select("id,first_name,last_name,institution,avatar_url")
            .eq("id", userId)
            .maybeSingle();

          if (profileErr) throw profileErr;

          // 2. Fetch role
          const { data: roleData, error: roleErr } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle();

          if (roleErr && roleErr.code !== "PGRST116") {
            console.warn("[UserProfile] Error fetching role:", roleErr);
          }

          const defaultFirst = (user?.user_metadata?.first_name as string) || "";
          const defaultLast = (user?.user_metadata?.last_name as string) || "";
          const email = user?.email || "";

          const profile: UserProfile = {
            id: userId,
            first_name: profileData?.first_name ?? defaultFirst,
            last_name: profileData?.last_name ?? defaultLast,
            institution: profileData?.institution ?? "Academic Institution",
            avatar_url: profileData?.avatar_url ?? null,
            role: (roleData?.role as UserProfile["role"]) ?? "student",
            email,
          };

          return profile;
        },
        {
          userId,
          ttlMs: 15 * 60 * 1000, // 15 minutes cache
          tags: ["profile"],
        },
      );
    },
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          first_name: updates.first_name,
          last_name: updates.last_name,
          institution: updates.institution,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Invalidate both secure cache and query client
      await secureUserCache.invalidateByTag("profile", { userId });
      queryClient.invalidateQueries({ queryKey: ["user-profile", userId] });
    },
  });

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    await secureUserCache.invalidateByTag("profile", { userId });
    queryClient.invalidateQueries({ queryKey: ["user-profile", userId] });
  }, [userId, queryClient]);

  const profile = query.data;
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email.split("@")[0]
    : user?.email?.split("@")[0] || "User";

  return {
    profile,
    fullName,
    role: profile?.role ?? "student",
    isLoading: query.isLoading,
    isUpdating: mutation.isPending,
    updateProfile: mutation.mutateAsync,
    refreshProfile,
  };
}
