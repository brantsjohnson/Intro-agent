// End-to-end orchestrator. Batches by event. y/n confirmation before every send.
import "dotenv/config";
import { discoverEvents } from "./src/discover-events.js";
import { extractEventDetails } from "./src/extract-event-details.js";
import { resolveContact } from "./src/resolve-contacts.js";
import { composeEmail } from "./src/compose-email.js";
import { sendEmail } from "./src/send-email.js";
import { confirm } from "./src/lib/prompt.js";
import { alreadySent } from "./src/lib/log.js";

const ROLES = {
  sponsor: "Head of Marketing or Partnerships",
  organizer: "Event Director or Head of Events",
};

async function main() {
  const events = await discoverEvents();
  if (!events.length) {
    console.log("No events discovered. Edit filters in .env or add seed-events.json.");
    return;
  }
  console.log(`Discovered ${events.length} event(s).\n`);

  for (const event of events) {
    console.log(`\n═══ ${event.name} (${event.date || "?"}) ═══`);
    console.log(event.url);

    let details;
    try {
      details = await extractEventDetails(event.url);
    } catch (err) {
      console.error(`  ✗ extraction failed: ${err.message}`);
      continue;
    }
    console.log(`  organizer: ${details.organizerName || "?"} @ ${details.organizerCompany || "?"}`);
    console.log(`  sponsors:  ${details.sponsors.map((s) => s.companyName).join(", ") || "(none found)"}`);
    if (details.confidence !== "high") console.log(`  ⚠ confidence: ${details.confidence}. ${details.notes || ""}`);

    /** @type {{ kind:"sponsor"|"organizer", company:string, contact:any, draft:any }[]} */
    const drafts = [];

    // Organizer
    if (details.organizerCompany) {
      const contact = await resolveContact({
        companyName: details.organizerCompany,
        targetRole: ROLES.organizer,
      });
      const email = contact.email || details.organizerEmail;
      if (email && !alreadySent({ eventUrl: event.url, recipientEmail: email })) {
        const draft = await composeEmail({
          kind: "organizer",
          companyName: details.organizerCompany,
          contactName: contact.name || details.organizerName,
          eventName: event.name,
          eventContext: `event URL: ${event.url}`,
        });
        drafts.push({ kind: "organizer", company: details.organizerCompany, contact: { ...contact, email }, draft });
      }
    }

    // Sponsors
    for (const sp of details.sponsors) {
      const contact = await resolveContact({ companyName: sp.companyName, targetRole: ROLES.sponsor });
      if (!contact.email || alreadySent({ eventUrl: event.url, recipientEmail: contact.email })) continue;
      const draft = await composeEmail({
        kind: "sponsor",
        companyName: sp.companyName,
        contactName: contact.name,
        eventName: event.name,
      });
      drafts.push({ kind: "sponsor", company: sp.companyName, contact, draft });
    }

    if (!drafts.length) {
      console.log("  (no sendable drafts for this event)");
      continue;
    }

    console.log(`\n  ── ${drafts.length} draft(s) for ${event.name} ──`);
    for (const d of drafts) {
      console.log(`\n  → ${d.kind.toUpperCase()} · ${d.company} · ${d.contact.name || "?"} <${d.contact.email}>`);
      console.log(`  Subject: ${d.draft.subject}`);
      console.log(d.draft.body.split("\n").map((l) => `  ${l}`).join("\n"));
    }

    const go = await confirm(`\nSend all ${drafts.length} email(s) for "${event.name}"?`);
    if (!go) {
      console.log("  skipped.");
      continue;
    }

    for (const d of drafts) {
      try {
        const res = await sendEmail({
          to: d.contact.email,
          toName: d.contact.name,
          subject: d.draft.subject,
          body: d.draft.body,
          eventName: event.name,
          eventUrl: event.url,
          kind: d.kind,
        });
        console.log(res.skipped ? `  ⊘ ${d.contact.email}: ${res.reason}` : `  ✓ sent to ${d.contact.email} (${res.gmailMessageId})`);
      } catch (err) {
        console.error(`  ✗ send to ${d.contact.email} failed: ${err.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
