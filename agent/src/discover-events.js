// Step 1: discover events matching filters, OR normalize a single known event URL.
// Two modes:
//   1. `node src/discover-events.js <event-url>` → fetch that page, return ONE normalized event.
//   2. `node src/discover-events.js`             → discover via search (Tavily) / Eventbrite / seed file.
// Output shape (both modes): [{ name, url, date, location, source }]
import "dotenv/config";
import { request } from "undici";
import * as cheerio from "cheerio";
import { fetchPage } from "./lib/fetch-page.js";

/**
 * @param {object} filters
 * @param {string[]} filters.industries
 * @param {string} filters.dateFrom  ISO date
 * @param {string} filters.dateTo    ISO date
 * @param {string[]} filters.regions
 */
export async function discoverEvents(filters = readFiltersFromEnv()) {
  const results = [];

  if (process.env.EVENTBRITE_API_KEY) {
    try {
      results.push(...(await searchEventbrite(filters)));
    } catch (err) {
      console.error("[eventbrite] failed:", err.message);
    }
  } else {
    console.warn("[discover] EVENTBRITE_API_KEY not set — skipping Eventbrite source.");
  }

  try {
    results.push(...(await webSearchFallback(filters)));
  } catch (err) {
    console.error("[search] failed:", err.message);
  }

  results.push(...(await seedFallback()));

  return dedupe(results);
}

/**
 * Fetch a single event URL and normalize it into one event object.
 * Prefers schema.org JSON-LD (`@type: Event`), falls back to OpenGraph / <title>.
 * Purely scrapes the page — no API keys required.
 * @param {string} url
 */
export async function normalizeEventFromUrl(url) {
  const page = await fetchPage(url);
  const $ = cheerio.load(page.html);

  const jsonLd = extractEventJsonLd($);

  const name =
    jsonLd?.name ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").first().text().trim() ||
    null;

  const date = jsonLd?.startDate || $('meta[property="event:start_time"]').attr("content") || null;

  const location = jsonLd ? formatLocation(jsonLd.location) : null;

  return {
    name: name ? name.trim() : null,
    url,
    date: date || null,
    location: location || null,
    source: jsonLd ? "jsonld" : "scrape",
  };
}

/** Pull the first schema.org Event object out of any <script type="application/ld+json">. */
function extractEventJsonLd($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some sites concatenate multiple JSON objects or wrap in arrays with trailing commas.
    }
  });

  const flat = [];
  const push = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(push);
    flat.push(node);
    if (Array.isArray(node["@graph"])) node["@graph"].forEach(push);
  };
  blocks.forEach(push);

  const isEvent = (t) => {
    if (!t) return false;
    const types = Array.isArray(t) ? t : [t];
    return types.some((x) => typeof x === "string" && /event/i.test(x));
  };

  return flat.find((n) => isEvent(n["@type"])) || null;
}

/** Turn a schema.org `location` (Place / VirtualLocation / string / array) into a readable string. */
function formatLocation(location) {
  if (!location) return null;
  if (Array.isArray(location)) {
    return location.map(formatLocation).filter(Boolean).join(" | ") || null;
  }
  if (typeof location === "string") return location;

  if (location["@type"] && /virtual/i.test(location["@type"])) {
    return location.url || "Online";
  }

  const name = location.name || null;
  const addr = location.address;
  let addrStr = null;
  if (typeof addr === "string") {
    addrStr = addr;
  } else if (addr && typeof addr === "object") {
    addrStr = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry]
      .filter(Boolean)
      .join(", ");
  }
  return [name, addrStr].filter(Boolean).join(" — ").replace(" — ", ", ") || name || null;
}

async function searchEventbrite() {
  // Eventbrite deprecated its public search endpoint in 2020. Without partner
  // access there is no usable server-side search, so this stays a no-op and the
  // pipeline relies on the search/seed fallbacks. Kept for shape stability.
  return [];
}

async function webSearchFallback(filters) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("[discover] TAVILY_API_KEY not set — skipping web search source.");
    return [];
  }

  const queries = buildSearchQueries(filters);
  const found = [];
  for (const q of queries) {
    try {
      const { body, statusCode } = await request("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query: q,
          search_depth: "basic",
          max_results: 8,
        }),
      });
      if (statusCode >= 400) {
        console.error(`[tavily] ${q} -> ${statusCode}`);
        continue;
      }
      const data = await body.json();
      for (const r of data.results || []) {
        found.push({ name: r.title, url: r.url, date: null, location: null, source: "tavily" });
      }
    } catch (err) {
      console.error(`[tavily] ${q}: ${err.message}`);
    }
  }
  return found;
}

function buildSearchQueries(filters) {
  const year = new Date().getFullYear();
  const industries = filters.industries?.length ? filters.industries : ["business"];
  const regions = filters.regions?.length ? filters.regions : [""];
  const queries = [];
  for (const ind of industries) {
    for (const region of regions) {
      queries.push(`${ind} conference ${region} ${year} ${year + 1}`.replace(/\s+/g, " ").trim());
    }
  }
  return queries.slice(0, 6);
}

async function seedFallback() {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(new URL("../seed-events.json", import.meta.url), "utf8");
    /** @type {{name:string,url:string,date?:string,location?:string}[]} */
    const seeds = JSON.parse(raw);
    return seeds.map((s) => ({
      name: s.name ?? null,
      url: s.url,
      date: s.date ?? null,
      location: s.location ?? null,
      source: "seed",
    }));
  } catch {
    return [];
  }
}

function dedupe(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = (e.url || `${e.name}|${e.date}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readFiltersFromEnv() {
  return {
    industries: (process.env.OUTREACH_INDUSTRIES || "").split(",").map((s) => s.trim()).filter(Boolean),
    dateFrom: process.env.OUTREACH_DATE_FROM || undefined,
    dateTo: process.env.OUTREACH_DATE_TO || undefined,
    regions: (process.env.OUTREACH_REGIONS || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

function looksLikeUrl(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

// CLI: `node src/discover-events.js [event-url]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  let events;
  if (looksLikeUrl(arg)) {
    events = [await normalizeEventFromUrl(arg)];
  } else {
    events = await discoverEvents();
  }
  console.log(JSON.stringify(events, null, 2));
  console.error(`\n${events.length} event(s) found.`);
}
