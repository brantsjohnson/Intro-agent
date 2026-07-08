import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Bot } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agent")({ component: AgentPage });

function AgentPage() {
  return (
    <AppShell>
      <PageHeader title="Agent" subtitle="Updates from your agent" />
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <Bot className="mx-auto mb-3 text-muted-foreground" size={28} />
        <p className="text-sm text-muted-foreground">No agent updates yet.</p>
        <p className="text-xs text-muted-foreground mt-2">
          This is where updates from your agent will appear. Share the integration
          details when you're ready and I'll wire it up.
        </p>
      </div>
    </AppShell>
  );
}
