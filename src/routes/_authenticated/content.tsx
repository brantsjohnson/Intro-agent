import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { listChannels, listDrafts } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { draftPost } from "@/lib/ai.functions";
import { publishLinkedInPost } from "@/lib/integrations.functions";
import { toast } from "sonner";
import { Loader2, Sparkles, ExternalLink, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/content")({ component: Content });

function Content() {
  const qc = useQueryClient();
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: listChannels });
  const { data: drafts } = useQuery({ queryKey: ["drafts"], queryFn: listDrafts });
  const [active, setActive] = useState<string | null>(null);
  const channelId = active ?? channels?.[0]?.id ?? null;
  const list = (drafts ?? []).filter((d) => !channelId || d.channel_id === channelId);
  const draft = useServerFn(draftPost);
  const m = useMutation({
    mutationFn: (topic: string) => draft({ data: { channelId: channelId!, topic: topic || undefined } }),
    onSuccess: () => { toast.success("Draft created."); qc.invalidateQueries({ queryKey: ["drafts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [topic, setTopic] = useState("");

  return (
    <AppShell>
      <PageHeader title="Content" subtitle="Each channel keeps its own voice." />

      <div className="flex flex-wrap gap-2 mb-6">
        {(channels ?? []).map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={"px-3 py-1.5 text-sm rounded-full border " + (channelId === c.id ? "bg-ink text-paper border-ink" : "border-border bg-card hover:border-ink")}>
            {c.name}
          </button>
        ))}
      </div>

      {channelId && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6 flex gap-2">
          <input
            value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Optional topic — or leave blank to pick from recent notes"
            className="flex-1 bg-paper border border-input rounded-md px-3 py-2 text-sm"
          />
          <button onClick={() => m.mutate(topic)} disabled={m.isPending}
            className="px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {m.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Draft post
          </button>
        </div>
      )}

      <div className="space-y-3">
        {list.map((d) => (
          <DraftCard key={d.id} draft={d} onChange={() => qc.invalidateQueries({ queryKey: ["drafts"] })} />
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No drafts here yet.</p>}
      </div>
    </AppShell>
  );
}

function DraftCard({ draft, onChange }: { draft: any; onChange: () => void }) {
  const [body, setBody] = useState(draft.body);
  const publish = useServerFn(publishLinkedInPost);
  const pm = useMutation({
    mutationFn: () => publish({ data: { draftId: draft.id, text: body } }),
    onSuccess: () => { toast.success("Posted to LinkedIn."); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  async function update(patch: any) { await supabase.from("content_drafts").update(patch).eq("id", draft.id); onChange(); }
  const isPersonal = draft.content_channels?.kind === "linkedin_personal";
  const isCompany = draft.content_channels?.kind === "linkedin_company";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="pill">{draft.status}</span>
        {draft.content_channels && <span className="text-xs text-muted-foreground">{draft.content_channels.name}</span>}
        <span className="text-xs text-muted-foreground ml-auto">{new Date(draft.created_at).toLocaleDateString()}</span>
      </div>
      {draft.title && <div className="font-medium text-sm mb-2">{draft.title}</div>}
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => body !== draft.body && update({ body })}
        rows={Math.min(12, body.split("\n").length + 2)}
        className="w-full bg-paper border border-input rounded-md p-3 text-sm font-sans resize-none"
      />
      <div className="flex gap-2 mt-3 flex-wrap">
        {draft.status !== "approved" && draft.status !== "posted" && (
          <button onClick={() => update({ status: "approved" })} className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted">Approve</button>
        )}
        {draft.status !== "posted" && (
          <button onClick={() => update({ status: "posted" })} className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted">Mark posted</button>
        )}
        {isPersonal && draft.status !== "posted" && (
          <button onClick={() => pm.mutate()} disabled={pm.isPending}
            className="text-xs px-3 py-1.5 bg-ink text-paper rounded-md hover:opacity-90 flex items-center gap-1 disabled:opacity-50">
            {pm.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Publish to LinkedIn
          </button>
        )}
        {isCompany && (
          <a href={"https://www.linkedin.com/company/setup/new/?shareActive=true&text=" + encodeURIComponent(body)}
            target="_blank" rel="noopener" className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted flex items-center gap-1">
            <ExternalLink size={12} /> Post to company page
          </a>
        )}
        <a href={"https://www.linkedin.com/feed/?shareActive=true&text=" + encodeURIComponent(body)}
          target="_blank" rel="noopener" className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted flex items-center gap-1 ml-auto">
          <ExternalLink size={12} /> Open in LinkedIn
        </a>
      </div>
    </div>
  );
}
