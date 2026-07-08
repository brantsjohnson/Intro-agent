// Step 3: given a company + target role, find a real name + email.
// Pluggable providers. Never fabricate emails.
import "dotenv/config";
import { fetchPage } from "./lib/fetch-page.js";
import { claudeJson } from "./lib/claude.js";

/**
 * @typedef {{ name:string|null, title:string|null, email:string|null, source:string, confidence:"high"|"medium"|"low", needsManualResearch:boolean }} Contact
 */

const providers = [siteScrapeProvider, hunterProvider /* , clayProvider */];

/**
 * @param {{ companyName: string, companyDomain?: string, targetRole: string }} input
 * @returns {Promise<Contact>}
 */
export async function resolveContact(input) {
  for (const provider of providers) {
    try {
      const hit = await provider(input);
      if (hit && hit.email && !hit.needsManualResearch) return hit;
    } catch (err) {
      console.error(`[resolve] ${provider.name} failed:`, err.message);
    }
  }
  return {
    name: null,
    title: null,
    email: null,
    source: "none",
    confidence: "low",
    needsManualResearch: true,
  };
}

// ---------- provider: scrape the company's own site ----------
async function siteScrapeProvider({ companyName, companyDomain, targetRole }) {
  const domain = companyDomain || (await guessDomain(companyName));
  if (!domain) return null;

  const candidates = [
    `https://${domain}/about`,
    `https://${domain}/team`,
    `https://${domain}/company/team`,
    `https://${domain}/contact`,
    `https://${domain}/people`,
  ];

  const pages = [];
  for (const url of candidates) {
    try {
      pages.push(await fetchPage(url));
    } catch {}
  }
  if (!pages.length) return null;

  const bundle = pages.map((p) => `--- ${p.url} ---\n${p.text.slice(0, 6000)}`).join("\n\n");

  const res = await claudeJson({
    instructions: `Find the person best matching the role "${targetRole}" at ${companyName}. Return only what's literally on the page. Never fabricate an email address.`,
    input: bundle,
    schemaHint: `{
      "name": string | null,
      "title": string | null,
      "email": string | null,
      "confidence": "high" | "medium" | "low"
    }`,
  });

  return {
    ...res,
    source: "site-scrape",
    needsManualResearch: !res.email,
  };
}

// ---------- provider: paid enrichment stub (Hunter.io) ----------
async function hunterProvider({ companyDomain, targetRole }) {
  if (!process.env.HUNTER_API_KEY || !companyDomain) return null;
  // TODO(cursor): implement Hunter.io Email Finder call.
  // Docs: https://hunter.io/api-documentation/v2#email-finder
  // Return { name, title, email, source: "hunter", confidence, needsManualResearch: false }
  return null;
}

async function guessDomain(companyName) {
  // Very rough. Cursor: replace with a real lookup (Clearbit autocomplete, DuckDuckGo, etc.).
  return null;
}

// CLI: `node src/resolve-contacts.js "Acme" "Head of Partnerships"`
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , companyName, targetRole] = process.argv;
  if (!companyName || !targetRole) {
    console.error(`usage: node src/resolve-contacts.js "<company>" "<role>"`);
    process.exit(1);
  }
  const contact = await resolveContact({ companyName, targetRole });
  console.log(JSON.stringify(contact, null, 2));
}
