import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { secureUserCache } from "@/lib/cache/secure-cache";

export function AppTopbar() {
  const [dark, setDark] = useState(false);
  const { user, signOut } = useAuth();
  const { fullName, role } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const email = user?.email ?? "";
  const displayName = fullName || email || "Account";
  const initials = (displayName.slice(0, 2) || "··").toUpperCase();

  const handleSignOut = async () => {
    secureUserCache.clearAll();
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 md:px-6">
      <SidebarTrigger />
      <span className="hidden text-xs text-muted-foreground sm:inline">Your workspace</span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-1 py-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden max-w-[180px] text-right leading-tight sm:block">
                <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
                <p className="text-[10px] capitalize text-muted-foreground">{role.replace("_", " ")}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">
              <div>
                <p className="font-semibold text-foreground">{displayName}</p>
                <p className="text-xs font-normal text-muted-foreground">{email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>Settings & billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
