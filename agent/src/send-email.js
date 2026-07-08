// Step 6: send via Gmail API. Uses the authenticated account from gmail-auth.js.
// Logs every send to sent-log.sqlite (dedup by event_url + recipient_email).
import "dotenv/config";
import { google } from "googleapis";
import { loadAuthorizedClient } from "./gmail-auth.js";
import { alreadySent, recordSend } from "./lib/log.js";

/**
 * @param {object} args
 * @param {string} args.to
 * @param {string|null} [args.toName]
 * @param {string} args.subject
 * @param {string} args.body        Plain text.
 * @param {string} args.eventName
 * @param {string} args.eventUrl
 * @param {"sponsor"|"organizer"} args.kind
 * @param {import("google-auth-library").OAuth2Client} [args.auth]
 */
export async function sendEmail(args) {
  const to = args.to?.trim();
  if (!to) throw new Error("Missing recipient");
  if (alreadySent({ eventUrl: args.eventUrl, recipientEmail: to })) {
    return { skipped: true, reason: "already sent for this event" };
  }

  const auth = args.auth || (await loadAuthorizedClient());
  const gmail = google.gmail({ version: "v1", auth });

  const from = process.env.GMAIL_SEND_AS;
  if (!from) throw new Error("GMAIL_SEND_AS is not set");

  const toHeader = args.toName ? `"${args.toName.replace(/"/g, "'")}" <${to}>` : to;
  const rfc2822 = [
    `From: ${from}`,
    `To: ${toHeader}`,
    `Subject: ${args.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    args.body,
  ].join("\r\n");

  const raw = Buffer.from(rfc2822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const { data } = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  recordSend({
    event_name: args.eventName,
    event_url: args.eventUrl,
    recipient_email: to,
    recipient_name: args.toName || null,
    subject: args.subject,
    kind: args.kind,
    gmail_message_id: data.id || null,
  });

  return { skipped: false, gmailMessageId: data.id };
}

// CLI: `node src/send-email.js` — sends a self-test.
if (import.meta.url === `file://${process.argv[1]}`) {
  const to = process.env.GMAIL_SEND_AS;
  const res = await sendEmail({
    to,
    subject: "Intro agent self-test",
    body: "This is a self-test from the outreach agent. If you received this, Gmail auth works.\n\nBrant",
    eventName: "Self test",
    eventUrl: `self-test:${Date.now()}`,
    kind: "organizer",
  });
  console.log(res);
}
