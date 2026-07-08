import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverSupabase } from "./supabase-server";

// Gmail + LinkedIn go through self-hosted n8n webhooks (n8n owns the OAuth to
// Google/LinkedIn). Each action has its own webhook URL, configured via env.
// A shared secret is sent as `x-webhook-secret` so the n8n workflow can reject
// anything that is not this app.

async function callWebhook<T = unknown>(
  urlEnv: string,
  payload: unknown,
): Promise<T> {
  const url = process.env[urlEnv];
  if (!url) {
    throw new Error(
      `${urlEnv} is not set. Add the n8n webhook URL to your environment to enable this integration.`,
    );
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) headers["x-webhook-secret"] = secret;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n ${urlEnv}: ${res.status} ${text}`);
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ────────── GMAIL ──────────

export const sendGmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      to: z.string().email(),
      subject: z.string().min(1),
      body: z.string().min(1),
      asDraft: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    return callWebhook("N8N_GMAIL_SEND_URL", {
      to: data.to,
      subject: data.subject,
      body: data.body,
      asDraft: data.asDraft ?? false,
    });
  });

const RecentEmail = z.object({
  id: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  date: z.string().optional(),
  snippet: z.string().optional(),
});

export const fetchRecentEmails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().optional(), max: z.number().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const raw = await callWebhook<unknown>("N8N_GMAIL_FETCH_URL", {
      query: data.query ?? "is:unread newer_than:7d",
      max: data.max ?? 15,
    });
    // n8n may return the array directly, or wrapped as { messages: [...] } / { data: [...] }.
    const arr = Array.isArray(raw)
      ? raw
      : ((raw as { messages?: unknown[]; data?: unknown[] })?.messages ??
          (raw as { data?: unknown[] })?.data ??
          []);
    return z.array(RecentEmail).catch([]).parse(arr);
  });

// ────────── LINKEDIN ──────────

export const publishLinkedInPost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      draftId: z.string().uuid().optional(),
      text: z.string().min(1),
      target: z.enum(["personal", "company"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = serverSupabase();

    // Decide personal vs company. Prefer explicit target, else derive from the
    // draft's channel kind.
    let target = data.target ?? "personal";
    if (!data.target && data.draftId) {
      const { data: draft } = await supabase
        .from("content_drafts")
        .select("channel_id, content_channels(kind)")
        .eq("id", data.draftId)
        .maybeSingle();
      const kind = (draft as { content_channels?: { kind?: string } } | null)?.content_channels?.kind;
      if (kind === "linkedin_company") target = "company";
    }

    const urlEnv = target === "company" ? "N8N_LINKEDIN_COMPANY_URL" : "N8N_LINKEDIN_PERSONAL_URL";
    const result = await callWebhook<{ id?: string; url?: string }>(urlEnv, { text: data.text });

    if (data.draftId) {
      await supabase
        .from("content_drafts")
        .update({ status: "posted", posted_url: result?.url ?? result?.id ?? null })
        .eq("id", data.draftId);
    }
    return { id: result?.id ?? null, url: result?.url ?? null, target };
  });
