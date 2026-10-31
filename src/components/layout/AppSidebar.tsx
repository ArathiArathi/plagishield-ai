import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, ScanSearch, FileBarChart, BarChart3,
  Database, Users, Settings, ShieldCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Analysis", url: "/analysis", icon: ScanSearch },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Repository", url: "/repository", icon: Database },
];

const orgItems = [
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];


import { useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname.startsWith(url);
  const { plan, docsUsed, docLimit, usagePercent, isLimitReached } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.4} />
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-sidebar-foreground">PlagiShield</span>
                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">AI Integrity</span>
              </div>
            )}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {orgItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          {!collapsed && (
            <div className="rounded-lg bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/80 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sidebar-foreground">{plan.name}</p>
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Upgrade
                </button>
              </div>
              <p className="text-[11px] text-sidebar-foreground/60">
                {docsUsed} / {docLimit} docs used {isLimitReached && <span className="text-destructive font-semibold">(Limit reached)</span>}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sidebar-border">
                <div
                  className={`h-full rounded-full transition-all ${
                    isLimitReached ? "bg-destructive" : usagePercent > 80 ? "bg-warning" : "bg-sidebar-primary"
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
