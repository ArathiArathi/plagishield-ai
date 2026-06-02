import { createFileRoute } from "@tanstack/react-router";
import { Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/layout/StatCard";
import { Activity, Users } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — PlagiShield AI" }, { name: "description", content: "Manage students, faculty, and administrators." }] }),
  component: TeamPage,
});

const members = [
  { name: "Aarav Patel", email: "aarav@mit.edu", role: "Faculty", dept: "Computer Science", status: "Active" },
  { name: "Priya Shah", email: "priya@mit.edu", role: "Student", dept: "EECS", status: "Active" },
  { name: "Liam Chen", email: "liam@mit.edu", role: "Student", dept: "Mechanical", status: "Pending" },
  { name: "Sara Müller", email: "sara@mit.edu", role: "Institution Admin", dept: "Administration", status: "Active" },
  { name: "James Okafor", email: "james@mit.edu", role: "Faculty", dept: "Physics", status: "Inactive" },
];

function TeamPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Team Management" description="Invite, organize, and assign roles for your institution."
        actions={<Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" />Invite member</Button>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Members" value="48" icon={Users} tone="primary" />
        <StatCard label="Active this week" value="36" icon={Activity} delta={6} tone="success" />
        <StatCard label="Pending invites" value="4" icon={Plus} tone="warning" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Members</h3>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Member</TableHead><TableHead>Role</TableHead>
            <TableHead>Department</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.email}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{m.name.split(" ").map(p => p[0]).join("")}</AvatarFallback></Avatar>
                    <div><p className="text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.dept}</TableCell>
                <TableCell><Badge className={
                  m.status === "Active" ? "bg-success/15 text-success" :
                  m.status === "Pending" ? "bg-warning/20 text-warning" :
                  "bg-muted text-muted-foreground"
                }>{m.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
