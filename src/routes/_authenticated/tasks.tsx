import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { listTasks } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({ component: Tasks });

function Tasks() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["tasks"], queryFn: listTasks });
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [newT, setNewT] = useState("");
  const tasks = (data ?? []).filter((t) => filter === "all" || t.status === filter);

  async function add() {
    await supabase.from("tasks").insert({ title: newT });
    setNewT(""); qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function toggle(id: string, status: string) {
    await supabase.from("tasks").update({ status: status === "done" ? "open" : "done" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <AppShell>
      <PageHeader title="Tasks"
        action={
          <div className="flex gap-1 bg-muted rounded-md p-0.5">
            {(["open","done","all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={"px-3 py-1 text-xs rounded " + (filter === f ? "bg-paper shadow-sm" : "text-muted-foreground")}>{f}</button>
            ))}
          </div>
        }
      />
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex gap-2">
        <input value={newT} onChange={(e) => setNewT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newT && add()}
          placeholder="Add a task..." className="flex-1 bg-paper border border-input rounded-md px-3 py-2 text-sm" />
        <button onClick={add} disabled={!newT} className="px-3 py-2 bg-ink text-paper rounded-md text-sm flex items-center gap-1 disabled:opacity-50"><Plus size={14}/>Add</button>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className={"checklist-item " + (t.status === "done" ? "done" : "")}>
            <input type="checkbox" checked={t.status === "done"} onChange={() => toggle(t.id, t.status ?? "open")} className="mt-1" />
            <div className="flex-1">
              <div className="title text-sm">{t.title}</div>
              {t.detail && <div className="text-xs text-muted-foreground mt-0.5">{t.detail}</div>}
            </div>
            {t.projects && <span className="pill" style={{ background: (t.projects as any).color + "22", color: (t.projects as any).color }}>{(t.projects as any).name}</span>}
            <span className="pill">{t.priority}</span>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nothing here.</p>}
      </div>
    </AppShell>
  );
}
