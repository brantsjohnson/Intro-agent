import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/agent")({ component: AgentPage });

type AgentUpdate = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

function kindIcon(kind: string) {
  switch (kind) {
    case "send":
      return <Mail size={16} className="text-emerald-600" />;
    case "draft":
      return <FileText size={16} className="text-blue-600" />;
    case "error":
      return <AlertCircle size={16} className="text-red-600" />;
    case "run_finished":
      return <CheckCircle2 size={16} className="text-emerald-600" />;
    case "run_started":
      return <Play size={16} className="text-amber-600" />;
    default:
      return <Info size={16} className="text-muted-foreground" />;
  }
}

function AgentPage() {
  const qc = useQueryClient();
  const [eventUrl, setEventUrl] = useState("");

  const { data: updates, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["agent-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_updates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AgentUpdate[];
    },
    refetchInterval: 5000,
  });

  const { data: pending } = useQuery({
    queryKey: ["agent-run-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_run_requests")
        .select("*")
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 4000,
  });

  const queueRun = useMutation({
    mutationFn: async (mode: "draft" | "send") => {
      const url = eventUrl.trim() || null;
      if (url && !/^https?:\/\//i.test(url)) throw new Error("Event URL must start with http(s)://");
      const { error } = await supabase.from("agent_run_requests").insert({
        mode,
        status: "pending",
        event_url: url,
        note: mode === "draft" ? "Queued from HQ Agent tab" : "Send run queued from HQ",
      });
      if (error) throw error;
    },
    onSuccess: (_, mode) => {
      toast.success(
        mode === "draft"
          ? "Draft run queued. Keep the agent watcher running on your laptop."
          : "Send run queued.",
      );
      qc.invalidateQueries({ queryKey: ["agent-run-pending"] });
      qc.invalidateQueries({ queryKey: ["agent-updates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agent_updates")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-updates"] }),
  });

  const isBusy = (pending?.length ?? 0) > 0;

  return (
    <AppShell>
      <PageHeader
        title="Agent"
        subtitle="Outreach drafts, sends, and run history from your laptop agent."
        action={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-50"
          >
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        }
      />

      <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-3">
        <div className="text-sm font-medium">Run outreach</div>
        <p className="text-xs text-muted-foreground">
          Queues a job for the local agent watcher (<code className="text-[11px]">npm run watch</code> in{" "}
          <code className="text-[11px]">agent/</code>). Draft mode finds people and emails, writes drafts
          here, and sends nothing.
        </p>
        <input
          type="url"
          value={eventUrl}
          onChange={(e) => setEventUrl(e.target.value)}
          placeholder="Optional event URL (e.g. https://…)"
          className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => queueRun.mutate("draft")}
            disabled={queueRun.isPending || isBusy}
            className="flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {queueRun.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run drafts
          </button>
          <button
            onClick={() => queueRun.mutate("send")}
            disabled={queueRun.isPending || isBusy}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-50"
          >
            Queue send run
          </button>
        </div>
        {isBusy && (
          <div className="text-xs text-amber-700 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            {(pending?.[0]?.status === "running" ? "Agent is running…" : "Waiting for watcher…") +
              ` (${pending?.[0]?.mode})`}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !updates || updates.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Bot className="mx-auto mb-3 text-muted-foreground" size={28} />
          <p className="text-sm text-muted-foreground">No agent updates yet.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Start the watcher on your laptop, then hit Run drafts. Activity shows up here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {updates.map((u) => (
            <div
              key={u.id}
              className={`bg-card border border-border rounded-lg p-4 ${u.read_at ? "opacity-70" : ""}`}
            >
              <div className="flex gap-3">
                <div className="mt-0.5">{kindIcon(u.kind)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{u.title}</div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(u.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">{u.kind.replace("_", " ")}</div>
                  {u.body && (
                    <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-auto">
                      {u.body}
                    </pre>
                  )}
                  {!u.read_at && (
                    <button
                      onClick={() => markRead.mutate(u.id)}
                      className="text-[11px] mt-2 text-muted-foreground hover:text-foreground underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
