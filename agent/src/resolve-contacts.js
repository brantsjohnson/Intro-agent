// Step 3: given a company + target role, find a real person (name + title) and the
// company domain, then GENERATE likely email addresses from name + domain.
//
// We never claim a guessed email is verified. Strategy (per Brant): find the person,
// guess the email with common patterns, and BCC several variants so one lands.
// If the company site literally lists an email, we trust that as the primary.
import "dotenv/config";
import { fetchPage } from "./lib/fetch-page.js";
import { claudeJson } from "./lib/claude.js";
import { webSearch, searchProvider } from "./lib/search.js";
import { emailPermutations, cleanDomain } from "./lib/email-permutations.js";

/**
 * @typedef {Object} Contact
 * @property {string|null} name
 * @property {string|null} title
 * @property {string|null} domain
 * @property {string|null} email          Verified/listed email if found, else best guess.
 * @property {string[]} emailGuesses      Ordered list of likely addresses (for BCC).
 * @property {boolean} emailVerified      True only if literally listed on a page.
 * @property {string} source
 * @property {"high"|"medium"|"low"} confidence
 * @property {boolean} needsManualResearch
 */

/**
 * @param {{ companyName: string, companyDomain?: string, targetRole: string }} input
 * @returns {Promise<Contact>}
 */
export async function resolveContact({ companyName, companyDomain, targetRole }) {
  const domain = cleanDomain(companyDomain) || (await findDomain(companyName));

  // 1. Try to find a real person for the role (search + site scrape).
  const person = await findPerson({ companyName, domain, targetRole });

  // 2. If a page literally listed an email, trust it.
  if (person?.listedEmail) {
    return {
      name: person.name,
      title: person.title,
      domain,
      email: person.listedEmail,
      emailGuesses: [person.listedEmail],
      emailVerified: true,
      source: person.source,
      confidence: person.confidence || "medium",
      needsManualResearch: false,
    };
  }

  // 3. Otherwise guess emails from the name + domain.
  if (person?.name && domain) {
    const guesses = emailPermutations(person.name, domain);
    if (guesses.length) {
      return {
        name: person.name,
        title: person.title,
        domain,
        email: guesses[0],
        emailGuesses: guesses,
        emailVerified: false,
        source: person.source,
        confidence: "low",
        needsManualResearch: false,
      };
    }
  }

  // 4. Nothing usable.
  return {
    name: person?.name || null,
    title: person?.title || null,
    domain: domain || null,
    email: null,
    emailGuesses: [],
    emailVerified: false,
    source: person?.source || "none",
    confidence: "low",
    needsManualResearch: true,
  };
}

// ---------- find the company's primary domain ----------
async function findDomain(companyName) {
  // Web search first (most reliable).
  try {
    const results = await webSearch(`${companyName} official website`, { maxResults: 5 });
    for (const r of results) {
      const d = cleanDomain(r.url);
      if (d && !isNoise(d)) return d;
    }
  } catch (err) {
    console.error(`[resolve] domain search failed: ${err.message}`);
  }
  return "";
}

const NOISE = /(linkedin|facebook|twitter|x\.com|instagram|youtube|crunchbase|wikipedia|glassdoor|indeed|bloomberg|tavily|google|bing)\./i;
function isNoise(domain) {
  return NOISE.test(domain);
}

// ---------- find a person matching the role ----------
async function findPerson({ companyName, domain, targetRole }) {
  const bundle = [];

  // a) Web search for the person.
  try {
    const results = await webSearch(`${companyName} ${targetRole} name`, { maxResults: 5 });
    for (const r of results) {
      bundle.push(`--- SEARCH: ${r.url} ---\n${r.title}\n${r.content}`.slice(0, 3000));
    }
  } catch (err) {
    console.error(`[resolve] person search failed: ${err.message}`);
  }

  // b) Scrape the company's own team/about/contact pages.
  if (domain) {
    const candidates = [
      `https://${domain}/about`,
      `https://${domain}/team`,
      `https://${domain}/company/team`,
      `https://${domain}/contact`,
      `https://${domain}/people`,
      `https://${domain}/leadership`,
    ];
    for (const url of candidates) {
      try {
        const page = await fetchPage(url);
        bundle.push(`--- PAGE: ${page.url} ---\n${page.text.slice(0, 5000)}`);
      } catch {}
    }
  }

  if (!bundle.length) return null;

  const res = await claudeJson({
    instructions: `Find the single person who best matches the role "${targetRole}" at ${companyName}. Use only what is literally in the text below. Return their full name and exact title. Return listedEmail ONLY if an email address is literally written in the text. Never fabricate an email address.`,
    input: bundle.join("\n\n"),
    schemaHint: `{
      "name": string | null,
      "title": string | null,
      "listedEmail": string | null,
      "confidence": "high" | "medium" | "low"
    }`,
  });

  return { ...res, source: searchProvider() !== "none" ? "search+scrape" : "scrape" };
}

// CLI: `node src/resolve-contacts.js "Acme" "Head of Partnerships" [domain]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , companyName, targetRole, companyDomain] = process.argv;
  if (!companyName || !targetRole) {
    console.error(`usage: node src/resolve-contacts.js "<company>" "<role>" [domain]`);
    process.exit(1);
  }
  const contact = await resolveContact({ companyName, targetRole, companyDomain });
  console.log(JSON.stringify(contact, null, 2));
}
