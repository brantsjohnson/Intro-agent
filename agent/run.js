// End-to-end orchestrator.
//
// RUN_MODE=draft (default): fully unattended. Discovers events, finds people, guesses
//   emails, drafts messages, and writes a review report to agent/drafts-review/.
//   Posts each draft into HQ agent_updates. Sends nothing.
// RUN_MODE=send: interactive. Shows drafts per event and asks y/n before sending.
//   Sends to the top guess and BCCs the other permutations so one variant lands.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { discoverEvents } from "./src/discover-events.js";
import { extractEventDetails } from "./src/extract-event-details.js";
import { resolveContact } from "./src/resolve-contacts.js";
import { composeEmail } from "./src/compose-email.js";
import { sendEmail } from "./src/send-email.js";
import { confirm } from "./src/lib/prompt.js";
import { alreadySent } from "./src/lib/log.js";
import { postAgentUpdate } from "./src/lib/hq.js";

const ROLES = {
  sponsor: "Head of Marketing or Partnerships",
  organizer: "Event Director or Head of Events",
};

const MODE = (process.env.RUN_MODE || "draft").toLowerCase();

async function main() {
  await postAgentUpdate({
    kind: "run_started",
    title: `Outreach agent started (${MODE})`,
    body: "Discovering events and drafting outreach…",
    meta: { mode: MODE },
  });

  const events = await discoverEvents();
  if (!events.length) {
    console.log("No events discovered. Edit filters in .env or add seed-events.json.");
    await postAgentUpdate({
      kind: "info",
      title: "No events found",
      body: "Add seed-events.json or set OUTREACH_* filters / Tavily, then run again.",
    });
    return;
  }
  console.log(`Discovered ${events.length} event(s). Mode: ${MODE}.\n`);

  /** @type {any[]} */
  const allDrafts = [];

  for (const event of events) {
    console.log(`\n═══ ${event.name} (${event.date || "?"}) ═══`);
    console.log(event.url);

    let details;
    try {
      details = await extractEventDetails(event.url);
    } catch (err) {
      console.error(`  ✗ extraction failed: ${err.message}`);
      await postAgentUpdate({
        kind: "error",
        title: `Extraction failed: ${event.name || event.url}`,
        body: err.message,
        meta: { eventUrl: event.url },
      });
      continue;
    }
    console.log(`  organizer: ${details.organizerName || "?"} @ ${details.organizerCompany || "?"}`);
    console.log(`  sponsors:  ${details.sponsors.map((s) => s.companyName).join(", ") || "(none found)"}`);
    if (details.confidence !== "high") console.log(`  ⚠ confidence: ${details.confidence}. ${details.notes || ""}`);

    const targets = [];
    if (details.organizerCompany) {
      targets.push({
        kind: "organizer",
        companyName: details.organizerCompany,
        role: ROLES.organizer,
        fallbackName: details.organizerName,
        fallbackEmail: details.organizerEmail,
      });
    }
    for (const sp of details.sponsors) {
      targets.push({ kind: "sponsor", companyName: sp.companyName, role: ROLES.sponsor });
    }

    for (const t of targets) {
      const contact = await resolveContact({ companyName: t.companyName, targetRole: t.role });
      const primary = contact.email || t.fallbackEmail || null;
      if (!primary) {
        console.log(`  · ${t.companyName}: no email found (${contact.name || "no name"}) — needs manual research`);
        await postAgentUpdate({
          kind: "info",
          title: `Needs research: ${t.companyName}`,
          body: `No email for ${contact.name || "unknown"} (${t.kind}) at ${event.name}.`,
          meta: { company: t.companyName, eventUrl: event.url },
        });
        continue;
      }
      if (alreadySent({ eventUrl: event.url, recipientEmail: primary })) {
        console.log(`  · ${t.companyName}: already contacted (${primary})`);
        continue;
      }
      const draft = await composeEmail({
        kind: t.kind,
        companyName: t.companyName,
        contactName: contact.name || t.fallbackName || null,
        eventName: event.name,
        eventContext: `event URL: ${event.url}`,
      });
      const entry = {
        event: { name: event.name, url: event.url, date: event.date || null },
        kind: t.kind,
        company: t.companyName,
        contact: { name: contact.name || t.fallbackName || null, title: contact.title || null },
        primaryEmail: primary,
        emailGuesses: contact.emailGuesses?.length ? contact.emailGuesses : [primary],
        emailVerified: contact.emailVerified,
        confidence: contact.confidence,
        subject: draft.subject,
        body: draft.body,
      };
      allDrafts.push(entry);
      console.log(
        `  ✓ drafted → ${t.companyName} · ${contact.name || "?"} <${primary}>${contact.emailVerified ? " (listed)" : " (guess)"}`,
      );
      await postAgentUpdate({
        kind: "draft",
        title: `Draft: ${t.companyName} (${t.kind})`,
        body: `To: ${primary}${entry.emailGuesses.length > 1 ? `\nBCC: ${entry.emailGuesses.slice(1).join(", ")}` : ""}\nSubject: ${draft.subject}\n\n${draft.body}`,
        meta: entry,
      });
    }
  }

  if (!allDrafts.length) {
    console.log("\nNo drafts produced.");
    await postAgentUpdate({
      kind: "run_finished",
      title: "Run finished — no drafts",
      body: "Nothing ready to send. Check company sites / search keys.",
      meta: { draftCount: 0, mode: MODE },
    });
    return;
  }

  if (MODE === "send") {
    await sendFlow(allDrafts);
  } else {
    writeReview(allDrafts);
    await postAgentUpdate({
      kind: "run_finished",
      title: `${allDrafts.length} draft(s) ready for review`,
      body: "Nothing was sent. Open the Agent tab to review, then request a send run when ready.",
      meta: { draftCount: allDrafts.length, mode: MODE },
    });
  }
}

function writeReview(drafts) {
  const dir = new URL("./drafts-review/", import.meta.url).pathname;
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = `${dir}${stamp}.json`;
  const mdPath = `${dir}${stamp}.md`;

  writeFileSync(jsonPath, JSON.stringify(drafts, null, 2));

  const lines = [
    `# Outreach drafts — ${new Date().toLocaleString()}`,
    "",
    `${drafts.length} draft(s). Review in HQ Agent tab, then run \`RUN_MODE=send npm start\` to send.`,
    "",
  ];
  for (const d of drafts) {
    lines.push(
      `---`,
      "",
      `## ${d.company} — ${d.kind}`,
      `**Event:** ${d.event.name} (${d.event.url})`,
      `**Person:** ${d.contact.name || "?"}${d.contact.title ? ` — ${d.contact.title}` : ""}`,
      `**Send to:** ${d.primaryEmail} ${d.emailVerified ? "(listed on site)" : "(guessed)"}`,
      d.emailGuesses.length > 1 ? `**BCC variants:** ${d.emailGuesses.join(", ")}` : "",
      `**Confidence:** ${d.confidence}`,
      "",
      `**Subject:** ${d.subject}`,
      "",
      "```",
      d.body,
      "```",
      "",
    );
  }
  writeFileSync(mdPath, lines.filter((l) => l !== undefined && l !== "").join("\n"));

  console.log(`\n📝 ${drafts.length} draft(s) written for review:`);
  console.log(`   ${mdPath}`);
  console.log(`   ${jsonPath}`);
  console.log(`\nNothing was sent. Review in HQ, then run: RUN_MODE=send npm start`);
}

async function sendFlow(drafts) {
  const cap = process.env.SEND_CAP ? parseInt(process.env.SEND_CAP, 10) : Infinity;
  let sent = 0;
  for (const d of drafts) {
    if (sent >= cap) {
      console.log(`\nReached SEND_CAP (${cap}). Stopping.`);
      break;
    }
    console.log(`\n→ ${d.kind.toUpperCase()} · ${d.company} · ${d.contact.name || "?"} <${d.primaryEmail}>`);
    if (d.emailGuesses.length > 1) console.log(`  BCC: ${d.emailGuesses.slice(1).join(", ")}`);
    console.log(`  Subject: ${d.subject}`);
    console.log(d.body.split("\n").map((l) => `  ${l}`).join("\n"));

    const go = await confirm(`\nSend this email?`);
    if (!go) {
      console.log("  skipped.");
      continue;
    }
    try {
      const res = await sendEmail({
        to: d.primaryEmail,
        toName: d.contact.name,
        bcc: d.emailGuesses.slice(1),
        subject: d.subject,
        body: d.body,
        eventName: d.event.name,
        eventUrl: d.event.url,
        kind: d.kind,
      });
      console.log(res.skipped ? `  ⊘ ${res.reason}` : `  ✓ sent (${res.gmailMessageId || "ok"})`);
      if (!res.skipped) sent += 1;
    } catch (err) {
      console.error(`  ✗ send failed: ${err.message}`);
      await postAgentUpdate({
        kind: "error",
        title: `Send failed: ${d.primaryEmail}`,
        body: err.message,
        meta: { company: d.company },
      });
    }
  }
  await postAgentUpdate({
    kind: "run_finished",
    title: `Send run finished (${sent} sent)`,
    body: `${sent} of ${drafts.length} draft(s) delivered.`,
    meta: { sent, total: drafts.length },
  });
}

main().catch(async (err) => {
  console.error(err);
  await postAgentUpdate({ kind: "error", title: "Agent crashed", body: String(err?.message || err) });
  process.exit(1);
});
