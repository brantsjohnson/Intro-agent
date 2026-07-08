import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { serverSupabase } from "./supabase-server";

const GW = "https://connector-gateway.lovable.dev";

function authHeaders(connectorKey: string) {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env[connectorKey];
  if (!lovable) throw new Error("LOVABLE_API_KEY missing");
  if (!conn) throw new Error(`${connectorKey} missing — connect the integration`);
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
  };
}

// ────────── GMAIL ──────────

function rfc2822(to: string, subject: string, body: string) {
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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
    const raw = rfc2822(data.to, data.subject, data.body);
    const path = data.asDraft
      ? "/google_mail/gmail/v1/users/me/drafts"
      : "/google_mail/gmail/v1/users/me/messages/send";
    const body = data.asDraft ? { message: { raw } } : { raw };
    const res = await fetch(`${GW}${path}`, {
      method: "POST",
      headers: authHeaders("GOOGLE_MAIL_API_KEY"),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gmail: ${res.status} ${await res.text()}`);
    return res.json();
  });

export const fetchRecentEmails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().optional(), max: z.number().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const q = encodeURIComponent(data.query ?? "is:unread newer_than:7d");
    const max = data.max ?? 15;
    const list = await fetch(
      `${GW}/google_mail/gmail/v1/users/me/messages?maxResults=${max}&q=${q}`,
      { headers: authHeaders("GOOGLE_MAIL_API_KEY") },
    );
    if (!list.ok) throw new Error(`Gmail list: ${list.status} ${await list.text()}`);
    const { messages = [] } = (await list.json()) as { messages?: { id: string }[] };

    const details = await Promise.all(
      messages.slice(0, max).map(async (m) => {
        const r = await fetch(
          `${GW}/google_mail/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: authHeaders("GOOGLE_MAIL_API_KEY") },
        );
        if (!r.ok) return null;
        const j = (await r.json()) as {
          id: string;
          snippet?: string;
          payload?: { headers?: { name: string; value: string }[] };
        };
        const h = (n: string) =>
          j.payload?.headers?.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        return {
          id: j.id,
          from: h("From"),
          subject: h("Subject"),
          date: h("Date"),
          snippet: j.snippet ?? "",
        };
      }),
    );
    return details.filter(Boolean);
  });

// ────────── LINKEDIN ──────────

async function linkedInMe() {
  const res = await fetch(`${GW}/linkedin/v2/userinfo`, {
    headers: authHeaders("LINKEDIN_API_KEY"),
  });
  if (!res.ok) throw new Error(`LinkedIn me: ${res.status} ${await res.text()}`);
  return (await res.json()) as { sub: string; name?: string; email?: string };
}

export const getLinkedInProfile = createServerFn({ method: "GET" })
  .handler(async () => linkedInMe());

export const publishLinkedInPost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      draftId: z.string().uuid().optional(),
      text: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await linkedInMe();
    const author = `urn:li:person:${me.sub}`;
    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: data.text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const res = await fetch(`${GW}/linkedin/v2/ugcPosts`, {
      method: "POST",
      headers: { ...authHeaders("LINKEDIN_API_KEY"), "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`LinkedIn post: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { id?: string };

    if (data.draftId) {
      const supabase = serverSupabase();
      await supabase
        .from("content_drafts")
        .update({ status: "posted", posted_url: json.id ? `urn:${json.id}` : null })
        .eq("id", data.draftId);
    }
    return { id: json.id };
  });
