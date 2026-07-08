// Thin Anthropic wrapper. Strict JSON helper enforces the "return only JSON" contract.
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export async function claudeText({ system, user, model = DEFAULT_MODEL, maxTokens = 1024 }) {
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
}

/**
 * Strict JSON extraction. System prompt is locked to "JSON only, no prose".
 * Throws if the model returns anything that doesn't parse.
 */
export async function claudeJson({ instructions, input, schemaHint, model = DEFAULT_MODEL, maxTokens = 2048 }) {
  const system = [
    "You are a strict JSON extractor.",
    "Return ONE JSON object matching the schema below. No prose. No markdown fences. No commentary.",
    "If a field is unknown, use null. Never fabricate emails, names, or URLs.",
    "Flag low-confidence extractions by setting `confidence` to \"low\".",
    "",
    "SCHEMA:",
    schemaHint,
  ].join("\n");

  const raw = await claudeText({ system, user: `${instructions}\n\nINPUT:\n${input}`, model, maxTokens });
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude returned non-JSON:\n${raw}`);
  }
}
