// Post activity from the local CLI agent into HQ's agent_updates table.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * @param {{ kind: string, title: string, body?: string|null, meta?: object|null }} update
 */
export async function postAgentUpdate(update) {
  const sb = client();
  if (!sb) {
    console.warn("[hq] SUPABASE_URL / key not set — skipping HQ update");
    return null;
  }
  const { data, error } = await sb
    .from("agent_updates")
    .insert({
      kind: update.kind,
      title: update.title,
      body: update.body ?? null,
      meta: update.meta ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error(`[hq] failed to post update: ${error.message}`);
    return null;
  }
  return data;
}
