import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { todayChecklist } from "@/lib/queries";
import { generateToday } from "@/lib/ai.functions";
import { sendGmail } from "@/lib/integrations.functions";
import { Sparkles, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({ component: Home });

type Payload = Awaited<ReturnType<typeof generateToday>>;

function Home() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["today"], queryFn: todayChecklist });
  const gen = useServerFn(generateToday);
  const m = useMutation({
    mutationFn: () => gen(),
    onSuccess: () => { toast.success("Today's plan ready."); qc.invalidateQueries({ queryKey: ["today"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const payload = data?.payload as Payload | undefined;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <AppShell>
      <PageHeader
        title="Today"
        subtitle={today}
        action={
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate Today
          </button>
        }
      />

      {isLoading ? null : !payload ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No plan for today yet.</p>
          <p className="text-xs text-muted-foreground mt-2">Click <em>Generate Today</em> to draft your checklist from recent notes, tasks, and follow-ups.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Top tasks">
            <div className="space-y-2">
              {payload.top_tasks.map((t, i) => (
                <div key={i} className="checklist-item">
                  <div className="mt-1 w-4 h-4 rounded border border-border" />
                  <div className="flex-1">
                    <div className="title text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.project && <span className="pill mr-2">{t.project}</span>}{t.why}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Follow-ups">
            <div className="space-y-2">
              {payload.followups.map((f, i) => (
                <FollowupRow key={i} name={f.name} message={f.message} />
              ))}
              {payload.followups.length === 0 && <p className="text-xs text-muted-foreground">All clear.</p>}
            </div>
          </Section>

          <Section title="Personal LinkedIn draft">
            <PostCard title={payload.personal_post.title} body={payload.personal_post.body} />
          </Section>
          <Section title="Intro company LinkedIn draft">
            <PostCard title={payload.company_post.title} body={payload.company_post.body} />
          </Section>

          <Section title="Open loops needing a decision">
            <ul className="space-y-2">
              {payload.open_loop_decisions.map((l, i) => (
                <li key={i} className="checklist-item text-sm">{l}</li>
              ))}
            </ul>
          </Section>

          <Section title="What you've been thinking">
            <ul className="space-y-2 text-sm">
              {payload.recent_thoughts.map((t, i) => (
                <li key={i} className="border-l-2 border-accent pl-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{t.project}</div>
                  <div>{t.thought}</div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}
function PostCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="font-medium text-sm mb-2">{title}</div>
      <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">{body}</pre>
    </div>
  );
}

function FollowupRow({ name, message }: { name: string; message: string }) {
  const send = useServerFn(sendGmail);
  const m = useMutation({
    mutationFn: (to: string) => send({ data: { to, subject: `Following up — ${name}`, body: message } }),
    onSuccess: () => toast.success("Email sent."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="checklist-item">
      <div className="flex-1">
        <div className="title text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{message}</div>
      </div>
      <button
        onClick={() => {
          const to = window.prompt(`Send to (email) for ${name}:`);
          if (to) m.mutate(to);
        }}
        disabled={m.isPending}
        className="text-xs px-2 py-1 border border-border rounded-md hover:bg-muted flex items-center gap-1 disabled:opacity-50"
      >
        {m.isPending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Send
      </button>
    </div>
  );
}
