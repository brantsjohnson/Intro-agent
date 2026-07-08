import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchRecentEmails } from "@/lib/integrations.functions";
import { classifyDump } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Inbox as InboxIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox")({ component: Inbox });

function Inbox() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(fetchRecentEmails);
  const classify = useServerFn(classifyDump);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["gmail-recent"],
    queryFn: () => fetchFn({ data: { query: "newer_than:7d", max: 20 } }),
  });

  const send = useMutation({
    mutationFn: async (email: any) => {
      const text = `From: ${email.from}\nSubject: ${email.subject}\n\n${email.snippet}`;
      const { data: note, error } = await supabase
        .from("source_notes")
        .insert({ raw_text: text, source: "gmail" })
        .select()
        .single();
      if (error) throw error;
      await classify({ data: { noteId: note.id } });
    },
    onSuccess: () => { toast.success("Captured."); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader
        title="Inbox"
        subtitle="Recent Gmail. Capture anything that should become a task, memory, or follow-up."
        action={
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-50">
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data || data.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <InboxIcon className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No recent mail.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((e: any) => (
            <div key={e.id} className="bg-card border border-border rounded-lg p-4 flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">{e.from}</div>
                <div className="font-medium text-sm truncate">{e.subject || "(no subject)"}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{e.snippet}</div>
              </div>
              <button onClick={() => send.mutate(e)} disabled={send.isPending}
                className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted flex items-center gap-1 self-start whitespace-nowrap disabled:opacity-50">
                <Sparkles size={12} /> Capture
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
