// HTML fetch → { html, text, links }. Uses undici + cheerio.
import { request } from "undici";
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; IntroOutreachBot/0.1; +https://intro.co)";

export async function fetchPage(url) {
  const { statusCode, body, headers } = await request(url, {
    method: "GET",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    maxRedirections: 5,
  });
  if (statusCode >= 400) throw new Error(`GET ${url} -> ${statusCode}`);
  const html = await body.text();
  const $ = cheerio.load(html);

  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const label = $(el).text().trim();
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      links.push({ href: abs, label });
    } catch {}
  });

  // Sponsor logo grids often use alt text or aria-label instead of text.
  const imageAlts = [];
  $("img[alt]").each((_, el) => {
    const alt = $(el).attr("alt")?.trim();
    if (alt && alt.length > 1) imageAlts.push(alt);
  });

  return { url, statusCode, contentType: headers["content-type"], html, text, links, imageAlts };
}

/** Find likely sponsors/partners and about/contact pages linked from an event page. */
export function findRelatedLinks(page) {
  const wants = {
    sponsors: /(sponsor|partner|exhibitor)s?/i,
    contact: /(contact|about|team|people)/i,
  };
  const out = { sponsors: [], contact: [] };
  for (const link of page.links) {
    for (const [key, re] of Object.entries(wants)) {
      if (re.test(link.label) || re.test(link.href)) out[key].push(link.href);
    }
  }
  // Dedupe.
  out.sponsors = [...new Set(out.sponsors)];
  out.contact = [...new Set(out.contact)];
  return out;
}
