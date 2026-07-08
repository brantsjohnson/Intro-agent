// Step 5: draft a plain-text outreach email.
// Enforces: no em dashes, ≤120 words body, subject <8 words, no "!", no clichés.
import "dotenv/config";
import { claudeJson } from "./lib/claude.js";

const SENDER_NAME = process.env.SENDER_NAME || "Brant";

const POSITIONING = {
  sponsor: {
    oneLine: "Intro helps sponsors generate and prove more value from every event sponsorship.",
    problem:
      "Sponsors pay real money and afterward get a badge-scan spreadsheet. They don't know which conversations happened, whether they met the right people, or whether it's worth renewing.",
    solution:
      "Intro helps attendees discover the sponsor when it's relevant, introduces qualified people to their team, and shows what the sponsorship actually produced.",
    benefits: [
      "higher quality conversations instead of random foot traffic",
      "warm introductions to attendees who fit their business",
      "more booth engagement",
      "better lead quality",
      "analytics that prove sponsorship ROI",
      "easier budget justification next year",
    ],
    angle:
      "They're already paying for the event and deserve to know what that money produced. Ask softly: gauge interest, suggest they mention Intro to the event organizer (organizer is the buyer).",
  },
  organizer: {
    oneLine:
      "Intro helps event organizers create better event outcomes and prove their events were worth the investment.",
    problem:
      "An event only succeeds if attendees meet valuable people, sponsors see ROI, speakers reach the right audience, and people come back. Right now networking is left to chance.",
    solution:
      "Intro guides attendees toward meaningful conversations, helps sponsors get measurable ROI, and gives the organizer analytics on what actually happened after people walked into the room.",
    benefits: [
      "better attendee experience instead of wandering a room of strangers",
      "sponsor retention because sponsors get measurable outcomes",
      "real outcome metrics: conversations started, meetings completed, sponsor engagement, introductions made",
      "higher renewal rates",
    ],
    angle:
      "If the event has visible sponsors, note that sponsors increasingly ask for measurable ROI, and Intro solves that plus the attendee experience problem in one platform. Observational, not pushy.",
  },
};

const TONE_RULES = [
  "Plain text only. No HTML, images, or formatting tricks.",
  "NO EM DASHES anywhere. Use commas, periods, or ' - ' with spaces only if needed.",
  "Short sentences. Everyday words. No corporate buzzwords.",
  "Body: max 120 words. One clear ask, easy to say no to.",
  "Reference something specific about their event or company. Not template-feeling.",
  `Sign off with just "${SENDER_NAME}". No "Best regards" filler.`,
  "Subject: under 8 words, no exclamation points, no 'quick question' cliches, not salesy.",
];

/**
 * @param {object} args
 * @param {"sponsor"|"organizer"} args.kind
 * @param {string} args.companyName
 * @param {string|null} args.contactName
 * @param {string} args.eventName
 * @param {string} [args.eventContext]   Free-text about the event to reference specifically.
 * @returns {Promise<{ subject: string, body: string }>}
 */
export async function composeEmail(args) {
  const pos = POSITIONING[args.kind];
  if (!pos) throw new Error(`Unknown kind: ${args.kind}`);

  const draft = await claudeJson({
    instructions: [
      `Write a cold outreach email from ${SENDER_NAME} to ${args.contactName || "the right person"} at ${args.companyName}, who ${args.kind === "sponsor" ? "is sponsoring" : "is running"} the event "${args.eventName}".`,
      `Product positioning: ${pos.oneLine}`,
      `Their problem: ${pos.problem}`,
      `What Intro does for them: ${pos.solution}`,
      `Pick ONE OR TWO of these benefits (do not list all): ${pos.benefits.join("; ")}.`,
      `Angle: ${pos.angle}`,
      `Reference this event specifically: ${args.eventName}. ${args.eventContext ? `Context you may use: ${args.eventContext}` : ""}`,
      "",
      "STRICT TONE RULES:",
      ...TONE_RULES.map((r) => `- ${r}`),
    ].join("\n"),
    input: JSON.stringify(args),
    schemaHint: `{ "subject": string, "body": string }`,
    maxTokens: 800,
  });

  return sanitize(draft);
}

function sanitize({ subject, body }) {
  const stripEmDash = (s) => s.replace(/[\u2014\u2013]/g, ",");
  const subj = stripEmDash(subject).replace(/!+/g, "").trim();
  const bod = stripEmDash(body).trim();
  const wordCount = bod.split(/\s+/).length;
  if (wordCount > 120) console.warn(`[compose] body is ${wordCount} words (>120). Consider a re-run.`);
  if (subj.split(/\s+/).length > 8) console.warn(`[compose] subject is >8 words: "${subj}"`);
  return { subject: subj, body: bod };
}

// CLI: `node src/compose-email.js sponsor "Acme Corp" "Jane Doe" "SaaSFest 2026"`
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , kind, companyName, contactName, ...eventNameParts] = process.argv;
  const eventName = eventNameParts.join(" ");
  if (!kind || !companyName || !eventName) {
    console.error(`usage: node src/compose-email.js <sponsor|organizer> "<company>" "<contact>" "<event name>"`);
    process.exit(1);
  }
  const out = await composeEmail({ kind, companyName, contactName: contactName || null, eventName });
  console.log(`Subject: ${out.subject}\n\n${out.body}`);
}
