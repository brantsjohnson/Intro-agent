// Step 6: send outreach via an n8n webhook (n8n owns the Gmail OAuth, so the
// email lands in your normal sent folder and replies come back to your inbox).
// Logs every send to sent-log.sqlite (dedup by event_url + recipient_email).
import "dotenv/config";
import { alreadySent, recordSend } from "./lib/log.js";

/**
 * @param {object} args
 * @param {string} args.to
 * @param {string|null} [args.toName]
 * @param {string[]} [args.bcc]      Extra guessed addresses to BCC (permutation strategy).
 * @param {string} args.subject
 * @param {string} args.body        Plain text.
 * @param {string} args.eventName
 * @param {string} args.eventUrl
 * @param {"sponsor"|"organizer"} args.kind
 */
export async function sendEmail(args) {
  const to = args.to?.trim();
  if (!to) throw new Error("Missing recipient");
  const bcc = (args.bcc || []).map((e) => e.trim()).filter((e) => e && e !== to);
  if (alreadySent({ eventUrl: args.eventUrl, recipientEmail: to })) {
    return { skipped: true, reason: "already sent for this event" };
  }

  const url = process.env.N8N_EMAIL_SEND_URL;
  if (!url) {
    throw new Error(
      "N8N_EMAIL_SEND_URL is not set. Point it at your n8n Gmail-send webhook (see agent/.env.example).",
    );
  }

  const headers = { "Content-Type": "application/json" };
  if (process.env.N8N_WEBHOOK_SECRET) headers["x-webhook-secret"] = process.env.N8N_WEBHOOK_SECRET;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to,
      toName: args.toName ?? null,
      bcc: bcc.length ? bcc.join(", ") : null,
      from: process.env.GMAIL_SEND_AS ?? null,
      subject: args.subject,
      body: args.body,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`n8n send: ${res.status} ${text}`);

  let messageId = null;
  try {
    const json = JSON.parse(text);
    messageId = json.id ?? json.messageId ?? json.gmailMessageId ?? null;
  } catch {
    // Non-JSON response is fine; the send still succeeded.
  }

  recordSend({
    event_name: args.eventName,
    event_url: args.eventUrl,
    recipient_email: to,
    recipient_name: args.toName || null,
    subject: args.subject,
    kind: args.kind,
    gmail_message_id: messageId,
  });

  return { skipped: false, gmailMessageId: messageId };
}

// CLI: `node src/send-email.js` — sends a self-test to GMAIL_SEND_AS.
if (import.meta.url === `file://${process.argv[1]}`) {
  const to = process.env.GMAIL_SEND_AS;
  if (!to) {
    console.error("Set GMAIL_SEND_AS in .env to run the self-test.");
    process.exit(1);
  }
  const res = await sendEmail({
    to,
    subject: "Intro agent self-test",
    body: "This is a self-test from the outreach agent. If you received this, the n8n send webhook works.\n\nBrant",
    eventName: "Self test",
    eventUrl: `self-test:${Date.now()}`,
    kind: "organizer",
  });
  console.log(res);
}
