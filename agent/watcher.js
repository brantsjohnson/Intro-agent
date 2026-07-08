// Polls Supabase for pending agent_run_requests created from the HQ Agent tab,
// then runs the outreach pipeline and posts activity back as agent_updates.
import "dotenv/config";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { postAgentUpdate } from "./src/lib/hq.js";

const POLL_MS = Number(process.env.AGENT_WATCHER_POLL_MS || 5000);
const ROOT = dirname(fileURLToPath(import.meta.url));

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and publishable key required");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function claimNext(sb) {
  const { data: rows, error } = await sb
    .from("agent_run_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const row = rows?.[0];
  if (!row) return null;

  const { data: claimed, error: updErr } = await sb
    .from("agent_run_requests")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (updErr) throw updErr;
  return claimed;
}

function runAgent(request) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      RUN_MODE: request.mode === "send" ? "send" : "draft",
    };
    if (request.event_url) {
      env.EVENT_URL = request.event_url;
      writeSeed([{ name: null, url: request.event_url }]);
    }
    const child = spawn(process.execPath, [join(ROOT, "run.js")], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => {
      const s = chunk.toString();
      out += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      out += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

function writeSeed(events) {
  const path = join(ROOT, "seed-events.json");
  writeFileSync(path, JSON.stringify(events, null, 2));
}

async function tick(sb) {
  const req = await claimNext(sb);
  if (!req) return;

  console.log(`[watcher] claimed ${req.id} mode=${req.mode}`);
  await postAgentUpdate({
    kind: "run_started",
    title: `Agent run started (${req.mode})`,
    body: req.event_url || req.note || "Triggered from HQ Agent tab.",
    meta: { requestId: req.id, mode: req.mode },
  });

  const result = await runAgent(req);
  const ok = result.code === 0;
  await sb
    .from("agent_run_requests")
    .update({
      status: ok ? "done" : "error",
      finished_at: new Date().toISOString(),
      result: result.out.slice(-8000),
    })
    .eq("id", req.id);

  await postAgentUpdate({
    kind: ok ? "run_finished" : "error",
    title: ok ? `Agent run finished (${req.mode})` : `Agent run failed (${req.mode})`,
    body: result.out.slice(-2000) || (ok ? "Done." : `Exit ${result.code}`),
    meta: { requestId: req.id, exitCode: result.code },
  });
}

async function main() {
  const sb = supabase();
  console.log(`[watcher] polling every ${POLL_MS}ms for pending HQ agent runs…`);
  await postAgentUpdate({
    kind: "info",
    title: "Agent watcher online",
    body: "The local outreach agent is listening for Run requests from HQ.",
  });

  for (;;) {
    try {
      await tick(sb);
    } catch (err) {
      console.error(`[watcher] ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
