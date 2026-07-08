// Web search helper. Prefers Tavily (purpose-built, free tier), falls back to
// OpenAI's web_search tool if only an OpenAI key is present. Returns [] if neither
// is configured, so callers can degrade to pure site scraping.
import "dotenv/config";

/**
 * @typedef {{ title:string, url:string, content:string }} SearchResult
 */

/**
 * @param {string} query
 * @param {{ maxResults?: number }} [opts]
 * @returns {Promise<SearchResult[]>}
 */
export async function webSearch(query, opts = {}) {
  const maxResults = opts.maxResults ?? 5;
  if (process.env.TAVILY_API_KEY) return tavilySearch(query, maxResults);
  if (process.env.OPENAI_API_KEY) return openaiSearch(query, maxResults);
  return [];
}

export function searchProvider() {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

async function tavilySearch(query, maxResults) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    content: r.content || "",
  }));
}

// OpenAI Responses API with the web_search tool. Returns synthesized text as one
// pseudo-result plus any URL citations we can find.
async function openaiSearch(query, maxResults) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: query,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.output_text || "";
  const results = [{ title: "openai-web-search", url: "", content: text }];
  // Pull any citation URLs out of the annotations if present.
  try {
    for (const item of data.output || []) {
      for (const c of item.content || []) {
        for (const a of c.annotations || []) {
          if (a.url) results.push({ title: a.title || "", url: a.url, content: "" });
        }
      }
    }
  } catch {}
  return results.slice(0, maxResults + 1);
}
