// Step 2: given an event URL, extract organizer + sponsors as strict JSON.
// Fetches the event page, plus Sponsors/Partners and About/Contact if linked.
import "dotenv/config";
import { fetchPage, findRelatedLinks } from "./lib/fetch-page.js";
import { claudeJson } from "./lib/claude.js";

const SCHEMA = `{
  "organizerName": string | null,
  "organizerCompany": string | null,
  "organizerContactPage": string | null,
  "organizerEmail": string | null,     // ONLY if visible on the page. Never guess.
  "sponsors": [{ "companyName": string, "tier": string | null }],
  "confidence": "high" | "medium" | "low",
  "notes": string | null               // e.g. "sponsors extracted from logo alt text"
}`;

export async function extractEventDetails(eventUrl) {
  const main = await fetchPage(eventUrl);
  const related = findRelatedLinks(main);

  const extras = [];
  for (const url of [...related.sponsors.slice(0, 2), ...related.contact.slice(0, 2)]) {
    try {
      extras.push(await fetchPage(url));
    } catch (err) {
      console.error(`[extract] skip ${url}: ${err.message}`);
    }
  }

  // Build a compact text bundle for Claude. Include alt text (sponsor logos!).
  const bundle = [main, ...extras]
    .map((p) => {
      const alts = p.imageAlts.length ? `\nIMAGE ALT TEXT:\n${p.imageAlts.join(" | ")}` : "";
      return `--- PAGE: ${p.url} ---\n${p.text.slice(0, 8000)}${alts}`;
    })
    .join("\n\n");

  const result = await claudeJson({
    instructions: [
      "Extract the event's organizer and sponsors from the pages below.",
      "Sponsors may only appear as logo grids: use alt text and nearby text.",
      "Return organizerEmail ONLY if it's literally on the page. Never fabricate.",
      "If sponsor extraction is uncertain, set confidence to \"low\" and explain in notes.",
    ].join(" "),
    input: bundle,
    schemaHint: SCHEMA,
    maxTokens: 2048,
  });

  return { eventUrl, ...result };
}

// CLI: `node src/extract-event-details.js <url>`
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: node src/extract-event-details.js <event-url>");
    process.exit(1);
  }
  const out = await extractEventDetails(url);
  console.log(JSON.stringify(out, null, 2));
}
