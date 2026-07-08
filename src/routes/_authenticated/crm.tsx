import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { listContacts } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Mail, Linkedin, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({ component: CRM });

function CRM() {
  const qc = useQueryClient();
  const { data: contacts } = useQuery({ queryKey: ["contacts"], queryFn: listContacts });
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <AppShell>
      <PageHeader title="CRM" subtitle="Who to follow up with and what to say."
        action={<button onClick={() => setAdding(true)} className="flex items-center gap-2 px-3 py-2 bg-ink text-paper rounded-md text-sm"><Plus size={14}/>Add contact</button>}
      />
      {adding && <AddContact onClose={() => { setAdding(false); qc.invalidateQueries({ queryKey: ["contacts"] }); }} />}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Type</th><th className="text-left p-3">Last topic</th><th className="text-left p-3">Status</th><th></th></tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <>
                <tr key={c.id} className="border-t border-border hover:bg-muted/50 cursor-pointer" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <td className="p-3 font-medium">{c.name}{c.company && <span className="text-muted-foreground font-normal"> · {c.company}</span>}</td>
                  <td className="p-3 text-muted-foreground">{c.relationship_type ?? "—"}</td>
                  <td className="p-3 text-muted-foreground line-clamp-1">{c.last_topic ?? "—"}</td>
                  <td className="p-3"><span className="pill">{c.status}</span></td>
                  <td className="p-3 text-right text-muted-foreground">{c.next_followup_date ?? ""}</td>
                </tr>
                {open === c.id && (
                  <tr className="border-t border-border bg-paper">
                    <td colSpan={5} className="p-4">
                      <ContactDetail contact={c} onChange={() => qc.invalidateQueries({ queryKey: ["contacts"] })} />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {(contacts ?? []).length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No contacts yet. Drop a note like "talked to Erik about UVU" and the app will create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function ContactDetail({ contact, onChange }: { contact: any; onChange: () => void }) {
  const [c, setC] = useState(contact);
  async function save() { await supabase.from("contacts").update(c).eq("id", contact.id); onChange(); }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {["company", "role", "email", "linkedin_url", "relationship_type", "status", "last_topic", "they_care_about", "i_promised", "next_followup_date", "suggested_followup", "notes"].map((k) => (
        <div key={k} className={["last_topic","they_care_about","i_promised","suggested_followup","notes"].includes(k) ? "md:col-span-2" : ""}>
          <label className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</label>
          {["suggested_followup", "notes", "they_care_about", "i_promised", "last_topic"].includes(k) ? (
            <textarea value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} rows={2}
              className="w-full mt-1 bg-paper border border-input rounded-md p-2 text-sm" />
          ) : (
            <input value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })}
              type={k.includes("date") ? "date" : "text"}
              className="w-full mt-1 bg-paper border border-input rounded-md p-2 text-sm" />
          )}
        </div>
      ))}
      <div className="md:col-span-2 flex gap-2 items-center">
        <button onClick={save} className="px-3 py-1.5 bg-ink text-paper rounded-md text-xs">Save</button>
        {c.email && <a href={`mailto:${c.email}?subject=${encodeURIComponent(c.last_topic ?? "Quick follow-up")}&body=${encodeURIComponent(c.suggested_followup ?? "")}`} className="text-xs px-3 py-1.5 border border-border rounded-md flex items-center gap-1"><Mail size={12}/>Email</a>}
        {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 border border-border rounded-md flex items-center gap-1"><Linkedin size={12}/>LinkedIn</a>}
      </div>
    </div>
  );
}

function AddContact({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", company: "", relationship_type: "" });
  async function save() {
    await supabase.from("contacts").insert({ ...f });
    onClose();
  }
  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4 flex gap-2 items-end">
      <div className="flex-1 grid grid-cols-3 gap-2">
        <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="bg-paper border border-input rounded-md p-2 text-sm" />
        <input placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className="bg-paper border border-input rounded-md p-2 text-sm" />
        <input placeholder="Type (investor, sponsor...)" value={f.relationship_type} onChange={(e) => setF({ ...f, relationship_type: e.target.value })} className="bg-paper border border-input rounded-md p-2 text-sm" />
      </div>
      <button onClick={save} disabled={!f.name} className="px-3 py-2 bg-ink text-paper rounded-md text-sm disabled:opacity-50">Add</button>
      <button onClick={onClose} className="p-2"><X size={16}/></button>
    </div>
  );
}
