import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { listMemory, listProjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/memory")({ component: Memory });

function Memory() {
  const { data: memory } = useQuery({ queryKey: ["memory"], queryFn: listMemory });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [project, setProject] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const items = (memory ?? []).filter((m) =>
    (project === "all" || m.project_id === project) &&
    (q === "" || (m.title ?? "").toLowerCase().includes(q.toLowerCase()) || m.content.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <AppShell>
      <PageHeader title="Memory" subtitle="Searchable, project-separated." />
      <div className="flex gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="flex-1 bg-paper border border-input rounded-md px-3 py-2 text-sm" />
        <select value={project} onChange={(e) => setProject(e.target.value)} className="bg-paper border border-input rounded-md px-3 py-2 text-sm">
          <option value="all">All projects</option>
          {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              {m.projects && <span className="pill" style={{ background: (m.projects as any).color + "22", color: (m.projects as any).color }}>{(m.projects as any).name}</span>}
              <span className="text-xs text-muted-foreground ml-auto">{new Date(m.created_at).toLocaleDateString()}</span>
            </div>
            {m.title && <div className="text-sm font-medium">{m.title}</div>}
            <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{m.content}</div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No memory yet.</p>}
      </div>
    </AppShell>
  );
}
