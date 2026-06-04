import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, ScanSearch, FileBarChart, BarChart3,
  Database, Users, CreditCard, Settings, ShieldCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { ROUTE_ROLES } from "@/components/auth/RoleGuard";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Analysis", url: "/analysis", icon: ScanSearch },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Repository", url: "/repository", icon: Database },
];

const orgItems = [
  { title: "Team", url: "/team", icon: Users },
  { title: "Subscription", url: "/subscription", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
];

function allowed(roles: AppRole[], url: string) {
  const req = ROUTE_ROLES[url];
  return !req || roles.some((r) => req.includes(r));
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { roles } = useAuth();
  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);
  const visibleMain = mainItems.filter((i) => allowed(roles, i.url));
  const visibleOrg = orgItems.filter((i) => allowed(roles, i.url));

  return (
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
          <div className="rounded-lg bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/80">
            <p className="font-medium text-sidebar-foreground">Professional plan</p>
            <p className="mt-0.5 text-sidebar-foreground/60">1,284 / 5,000 docs used</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-border">
              <div className="h-full rounded-full bg-sidebar-primary" style={{ width: "26%" }} />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
