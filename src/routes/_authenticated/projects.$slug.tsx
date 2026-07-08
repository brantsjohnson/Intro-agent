import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$slug")({ component: ProjectDetail });

function ProjectDetail() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data: project } = useQuery({
    queryKey: ["project", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("slug", slug).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", project?.id],
    enabled: !!project,
    queryFn: async () => (await supabase.from("tasks").select("*").eq("project_id", project!.id).order("created_at", { ascending: false })).data,
  });
  const { data: memory } = useQuery({
    queryKey: ["project-memory", project?.id],
    enabled: !!project,
    queryFn: async () => (await supabase.from("project_memory").select("*").eq("project_id", project!.id).order("created_at", { ascending: false })).data,
  });
  const { data: loops } = useQuery({
    queryKey: ["project-loops", project?.id],
    enabled: !!project,
    queryFn: async () => (await supabase.from("open_loops").select("*").eq("project_id", project!.id).eq("status", "open")).data,
  });

  if (!project) return null;

  return (
    <div>
      <Link to="/projects" className="text-xs text-muted-foreground hover:text-ink inline-flex items-center gap-1 mb-4"><ArrowLeft size={12} /> All projects</Link>
      <PageHeader title={project.name} subtitle={project.description ?? undefined} />

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-8">
          <Section title="Open loops">
            {(loops ?? []).length === 0 && <p className="text-xs text-muted-foreground">No open questions.</p>}
            {(loops ?? []).map((l) => (
              <div key={l.id} className="checklist-item text-sm">{l.question}</div>
            ))}
          </Section>
          <Section title="Tasks">
            <div className="space-y-2">
              {(tasks ?? []).map((t) => (
                <div key={t.id} className={"checklist-item " + (t.status === "done" ? "done" : "")}>
                  <input type="checkbox" checked={t.status === "done"} onChange={async () => {
                    await supabase.from("tasks").update({ status: t.status === "done" ? "open" : "done" }).eq("id", t.id);
                    qc.invalidateQueries({ queryKey: ["project-tasks", project.id] });
                  }} />
                  <div className="flex-1">
                    <div className="title text-sm">{t.title}</div>
                    {t.detail && <div className="text-xs text-muted-foreground">{t.detail}</div>}
                  </div>
                  <span className="pill">{t.priority}</span>
                </div>
              ))}
              {(tasks ?? []).length === 0 && <p className="text-xs text-muted-foreground">No tasks.</p>}
            </div>
          </Section>
          <Section title="Memory">
            <div className="space-y-2">
              {(memory ?? []).map((m) => (
                <div key={m.id} className="bg-card border border-border rounded-lg p-3">
                  {m.title && <div className="text-sm font-medium">{m.title}</div>}
                  <div className="text-sm text-muted-foreground line-clamp-3 mt-1">{m.content}</div>
                </div>
              ))}
              {(memory ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nothing stored yet. Dump some notes.</p>}
            </div>
          </Section>
        </div>

        <InstructionsCard project={project} onSaved={() => qc.invalidateQueries({ queryKey: ["project", slug] })} />
      </div>
    </div>
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

function InstructionsCard({ project, onSaved }: { project: any; onSaved: () => void }) {
  const [form, setForm] = useState(project);
  useEffect(() => setForm(project), [project.id]);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({
        description: form.description, voice: form.voice, tone: form.tone,
        audience: form.audience, goals: form.goals,
        phrases_use: form.phrases_use, phrases_avoid: form.phrases_avoid, context: form.context,
      }).eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved."); onSaved(); },
  });

  const fields: [string, string, boolean?][] = [
    ["description", "Description"],
    ["audience", "Audience"],
    ["goals", "Goals"],
    ["voice", "Voice"],
    ["tone", "Tone"],
    ["phrases_use", "Phrases to use"],
    ["phrases_avoid", "Phrases to avoid"],
    ["context", "Important context", true],
  ];

  return (
    <aside className="bg-card border border-border rounded-lg p-5 self-start sticky top-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">AI instructions</h3>
      <div className="space-y-3">
        {fields.map(([k, label, big]) => (
          <div key={k}>
            <label className="text-xs text-muted-foreground">{label}</label>
            <textarea
              value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              rows={big ? 4 : 2}
              className="w-full mt-1 bg-paper border border-input rounded-md p-2 text-xs resize-none"
            />
          </div>
        ))}
        <button onClick={() => m.mutate()} disabled={m.isPending}
          className="w-full py-2 bg-ink text-paper rounded-md text-xs font-medium disabled:opacity-50">
          {m.isPending ? "Saving..." : "Save instructions"}
        </button>
      </div>
    </aside>
  );
}
