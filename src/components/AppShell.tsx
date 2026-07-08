import { Link } from "@tanstack/react-router";

import {
  LayoutGrid,
  Inbox,
  FolderKanban,
  PenSquare,
  Users,
  CheckSquare,
  Brain,
  Bot,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/home", label: "Today", icon: LayoutGrid },
  { to: "/dump", label: "Dump", icon: Inbox },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/content", label: "Content", icon: PenSquare },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/agent", label: "Agent", icon: Bot },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground p-4 sticky top-0 h-screen">
        <div className="px-2 py-4">
          <div className="serif text-xl text-white">Project HQ</div>
          <div className="text-xs text-sidebar-foreground/60 mt-1">thinking → action</div>
        </div>
        <nav className="flex-1 flex flex-col gap-0.5 mt-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent transition-colors"
                activeProps={{ className: "bg-sidebar-accent text-white" }}
              >
                <Icon size={16} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 bg-background">
        {/* mobile nav */}
        <div className="md:hidden sticky top-0 z-10 flex gap-1 overflow-x-auto bg-sidebar text-sidebar-foreground px-3 py-2 border-b border-sidebar-border">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="px-3 py-1.5 text-xs whitespace-nowrap rounded-md hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-white" }}
            >
              {n.label}
            </Link>
          ))}
        </div>
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="serif text-3xl text-ink">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
