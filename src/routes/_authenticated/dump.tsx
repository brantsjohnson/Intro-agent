import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { listNotes } from "@/lib/queries";
import { classifyDump } from "@/lib/ai.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dump")({ component: Dump });

function Dump() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [source, setSource] = useState("other");
  const { data: notes } = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const classify = useServerFn(classifyDump);

  const m = useMutation({
    mutationFn: async () => {
      const { data: note, error } = await supabase
        .from("source_notes")
        .insert({ raw_text: text, source })
        .select()
        .single();
      if (error) throw error;
      await classify({ data: { noteId: note.id } });
    },
    onSuccess: () => {
      toast.success("Organized.");
      setText("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Dump" subtitle="Paste anything. The app sorts it." />
      <div className="bg-card border border-border rounded-lg p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a thought, a meeting note, a draft, a transcript..."
          rows={8}
          className="w-full bg-paper border border-input rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center justify-between mt-3 gap-3">
          <select
            value={source} onChange={(e) => setSource(e.target.value)}
            className="text-xs border border-input rounded-md px-2 py-1.5 bg-paper"
          >
            <option value="other">source: other</option>
            <option value="apple_notes">apple notes</option>
            <option value="chatgpt">chatgpt</option>
            <option value="claude">claude</option>
            <option value="voice">voice memo</option>
            <option value="meeting">meeting</option>
          </select>
          <button
            disabled={!text.trim() || m.isPending}
            onClick={() => m.mutate()}
            className="px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {m.isPending && <Loader2 size={14} className="animate-spin" />}
            Organize
          </button>
        </div>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-10 mb-3">Recent</h2>
      <div className="space-y-2">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {n.classification && <span className="pill">{n.classification}</span>}
              {n.projects && <span className="pill" style={{ background: (n.projects as any).color + "22", color: (n.projects as any).color }}>{(n.projects as any).name}</span>}
              <span className="text-xs text-muted-foreground ml-auto">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            {n.summary && <div className="text-sm font-medium">{n.summary}</div>}
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.raw_text}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
