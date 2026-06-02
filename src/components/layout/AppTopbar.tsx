import { Bell, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function AppTopbar() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md md:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search documents, reports, sources..."
          className="h-9 pl-9 bg-muted/40 border-transparent focus-visible:bg-background"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-destructive p-0 text-[10px] leading-none text-destructive-foreground">3</Badge>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <div className="flex items-center gap-2 pr-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">AP</AvatarFallback>
          </Avatar>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-xs font-medium text-foreground">Aarav Patel</p>
            <p className="text-[10px] text-muted-foreground">Faculty · MIT</p>
          </div>
        </div>
      </div>
    </header>
  );
}
