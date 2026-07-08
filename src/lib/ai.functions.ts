import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropic } from "@ai-sdk/anthropic";
import { serverSupabase } from "./supabase-server";

function gateway() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  return createAnthropic({ apiKey: key });
}

// Cheap/fast model for high-frequency classification; stronger model for the
// content-heavy daily plan and post drafting.
const FAST_MODEL = "claude-haiku-4-5-20251001";
const SMART_MODEL = "claude-sonnet-4-5-20250929";

// ───── CLASSIFY DUMP ─────
export const classifyDump = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ noteId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = serverSupabase();
    const { data: note } = await supabase
      .from("source_notes")
      .select("id, raw_text")
      .eq("id", data.noteId)
      .single();
    if (!note) throw new Error("Note not found");

    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, slug, description");

    const projectList = (projects ?? [])
      .map((p) => `- ${p.slug}: ${p.name}${p.description ? ` — ${p.description}` : ""}`)
      .join("\n");

    const provider = gateway();
    const { output } = await generateText({
      model: provider(FAST_MODEL),
      prompt: `You are an assistant organizing a founder's messy brain dump.

PROJECTS:
${projectList || "(none yet)"}

NOTE:
"""${note.raw_text}"""

Decide:
- which project slug it belongs to (or null if cross-cutting/unknown)
- classification: one of task | memory | crm | content_idea | decision | open_question | follow_up | archive
- a one-sentence summary (under 140 chars)
- if classification = task: a clean task title + suggested priority (low|medium|high)
- if classification = content_idea: a suggested channel_kind (linkedin_personal | linkedin_company | other) and a draft body (2-4 short paragraphs in the right voice)
- if classification = open_question: rewrite as a crisp question
- if classification = crm or follow_up: contact name (best guess), suggested next action`,
      output: Output.object({
        schema: z.object({
          project_slug: z.string().nullable(),
          classification: z.enum([
            "task",
            "memory",
            "crm",
            "content_idea",
            "decision",
            "open_question",
            "follow_up",
            "archive",
          ]),
          summary: z.string(),
          task_title: z.string().nullable(),
          task_priority: z.enum(["low", "medium", "high"]).nullable(),
          content_channel_kind: z
            .enum(["linkedin_personal", "linkedin_company", "other"])
            .nullable(),
          content_body: z.string().nullable(),
          open_question: z.string().nullable(),
          contact_name: z.string().nullable(),
          next_action: z.string().nullable(),
        }),
      }),
    });

    const projectId =
      output.project_slug && projects
        ? projects.find((p) => p.slug === output.project_slug)?.id ?? null
        : null;

    // Update the note
    await supabase
      .from("source_notes")
      .update({
        project_id: projectId,
        classification: output.classification,
        summary: output.summary,
        processed: true,
        ai_meta: output,
      })
      .eq("id", note.id);

    // Side-effects per type
    if (output.classification === "task" && output.task_title) {
      await supabase.from("tasks").insert({
        project_id: projectId,
        source_note_id: note.id,
        title: output.task_title,
        detail: output.summary,
        priority: output.task_priority ?? "medium",
        ai_generated: true,
      });
    } else if (output.classification === "memory") {
      await supabase.from("project_memory").insert({
        project_id: projectId,
        source_note_id: note.id,
        title: output.summary,
        content: note.raw_text,
      });
    } else if (output.classification === "content_idea" && output.content_body) {
      const { data: channels } = await supabase
        .from("content_channels")
        .select("id, kind")
        .eq("kind", output.content_channel_kind ?? "linkedin_personal")
        .limit(1);
      await supabase.from("content_drafts").insert({
        channel_id: channels?.[0]?.id ?? null,
        project_id: projectId,
        source_note_id: note.id,
        title: output.summary,
        body: output.content_body,
        status: "idea",
        ai_generated: true,
      });
    } else if (output.classification === "open_question") {
      await supabase.from("open_loops").insert({
        project_id: projectId,
        source_note_id: note.id,
        question: output.open_question ?? output.summary,
      });
    } else if (
      (output.classification === "crm" || output.classification === "follow_up") &&
      output.contact_name
    ) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("name", output.contact_name)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("contacts")
          .update({
            last_topic: output.summary,
            suggested_followup: output.next_action,
            project_id: projectId,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("contacts").insert({
          name: output.contact_name,
          project_id: projectId,
          last_topic: output.summary,
          suggested_followup: output.next_action,
        });
      }
    }

    return output;
  });

// ───── GENERATE TODAY ─────
export const generateToday = createServerFn({ method: "POST" })
  .handler(async () => {
    const supabase = serverSupabase();
    const [{ data: tasks }, { data: notes }, { data: contacts }, { data: loops }, { data: projects }, { data: channels }] =
      await Promise.all([
        supabase.from("tasks").select("*").eq("status", "open").order("priority"),
        supabase.from("source_notes").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("contacts").select("*").or("next_followup_date.lte." + new Date().toISOString().slice(0,10) + ",status.eq.waiting").limit(20),
        supabase.from("open_loops").select("*").eq("status", "open").limit(20),
        supabase.from("projects").select("*"),
        supabase.from("content_channels").select("*"),
      ]);

    const personal = channels?.find((c) => c.kind === "linkedin_personal");
    const company = channels?.find((c) => c.kind === "linkedin_company");

    const ctx = `RECENT NOTES (most recent first):
${(notes ?? []).slice(0, 12).map((n) => `- [${n.classification ?? "raw"}] ${n.summary ?? n.raw_text.slice(0, 200)}`).join("\n")}

OPEN TASKS:
${(tasks ?? []).slice(0, 15).map((t) => `- (${t.priority}) ${t.title}`).join("\n") || "(none)"}

OPEN LOOPS:
${(loops ?? []).map((l) => `- ${l.question}`).join("\n") || "(none)"}

CONTACTS DUE OR WAITING:
${(contacts ?? []).map((c) => `- ${c.name} (${c.relationship_type ?? "—"}) — last topic: ${c.last_topic ?? "—"}`).join("\n") || "(none)"}

PROJECTS: ${(projects ?? []).map((p) => p.name).join(", ")}

PERSONAL LINKEDIN VOICE: ${personal?.voice ?? ""} / ${personal?.tone ?? ""}
COMPANY LINKEDIN VOICE: ${company?.voice ?? ""} / ${company?.tone ?? ""}
`;

    const provider = gateway();
    const { output } = await generateText({
      model: provider(SMART_MODEL),
      prompt: `You are the founder's daily command center. Generate today's checklist. Be specific, referencing actual notes/topics, not generic prompts.

${ctx}

Produce:
- top_tasks: 5 concrete tasks to do today, each referencing a project or topic
- personal_post: one specific draft LinkedIn post in the personal voice, drawn from a recent thought (full body text, 3-5 short paragraphs)
- company_post: one specific draft for the Intro company page in the company voice (full body text)
- followups: up to 5 people to follow up with today, each with a one-line suggested message
- open_loop_decisions: 2-3 open loops that need a decision now
- recent_thoughts: short bullets summarizing what the founder has been thinking about by project`,
      output: Output.object({
        schema: z.object({
          top_tasks: z.array(
            z.object({ title: z.string(), project: z.string().nullable(), why: z.string() }),
          ),
          personal_post: z.object({ title: z.string(), body: z.string() }),
          company_post: z.object({ title: z.string(), body: z.string() }),
          followups: z.array(z.object({ name: z.string(), message: z.string() })),
          open_loop_decisions: z.array(z.string()),
          recent_thoughts: z.array(z.object({ project: z.string(), thought: z.string() })),
        }),
      }),
    });

    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("daily_checklists").upsert(
      { date: today, payload: output },
      { onConflict: "date" },
    );

    if (personal && output.personal_post.body) {
      await supabase.from("content_drafts").insert({
        channel_id: personal.id,
        title: output.personal_post.title,
        body: output.personal_post.body,
        status: "drafted",
        ai_generated: true,
      });
    }
    if (company && output.company_post.body) {
      await supabase.from("content_drafts").insert({
        channel_id: company.id,
        title: output.company_post.title,
        body: output.company_post.body,
        status: "drafted",
        ai_generated: true,
      });
    }

    return output;
  });

// ───── DRAFT POST for a channel ─────
export const draftPost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ channelId: z.string().uuid(), topic: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = serverSupabase();
    const { data: channel } = await supabase
      .from("content_channels")
      .select("*")
      .eq("id", data.channelId)
      .single();
    if (!channel) throw new Error("Channel not found");

    const { data: notes } = await supabase
      .from("source_notes")
      .select("raw_text, summary")
      .order("created_at", { ascending: false })
      .limit(15);

    const provider = gateway();
    const { output } = await generateText({
      model: provider(SMART_MODEL),
      prompt: `Draft a post for "${channel.name}".
VOICE: ${channel.voice ?? ""}
TONE: ${channel.tone ?? ""}
PHRASES TO USE: ${channel.phrases_use ?? ""}
AVOID: ${channel.phrases_avoid ?? ""}

${data.topic ? `TOPIC: ${data.topic}` : "Pick the most resonant recent thought."}

RECENT THOUGHTS:
${(notes ?? []).map((n) => `- ${n.summary ?? n.raw_text.slice(0, 200)}`).join("\n")}

Write a real post (3-5 short paragraphs). No hashtags unless natural.`,
      output: Output.object({
        schema: z.object({ title: z.string(), body: z.string() }),
      }),
    });

    const { data: created } = await supabase
      .from("content_drafts")
      .insert({
        channel_id: channel.id,
        title: output.title,
        body: output.body,
        status: "drafted",
        ai_generated: true,
      })
      .select()
      .single();

    return created;
  });
