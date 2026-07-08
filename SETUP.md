# Project HQ — Setup & Integration Manual

A single-user "thinking → action" app. Dump raw thoughts → AI classifies them into tasks / memory / CRM / content ideas → daily checklist + LinkedIn/Gmail drafts on top.

Stack: **TanStack Start (Vite + React 19) · Supabase (Postgres) · Lovable AI Gateway · Gmail + LinkedIn via Lovable Connectors**.

---

## 1. What you're pasting into Cursor

```
src/
  routes/
    __root.tsx
    index.tsx                       # redirects to /home
    _authenticated/
      route.tsx                     # layout (no auth gate — single-user mode)
      home.tsx                      # Today: daily checklist + quick actions
      dump.tsx                      # Paste raw thoughts, AI classifies
      inbox.tsx                     # Gmail via connector
      tasks.tsx                     # Task list
      projects.tsx / projects.$slug.tsx
      crm.tsx                       # Contacts
      content.tsx                   # LinkedIn drafts per channel
      memory.tsx                    # Project memory notes
      agent.tsx                     # Placeholder for external agent updates
  lib/
    ai.functions.ts                 # classifyDump, generateToday, draftPost (server fns)
    integrations.functions.ts       # sendGmail, fetchRecentEmails, LinkedIn (server fns)
    ai-gateway.server.ts            # Lovable AI provider (OpenAI-compatible)
    supabase-server.ts              # Server Supabase client (publishable key)
    queries.ts                      # Client-side Supabase reads
  integrations/supabase/
    client.ts                       # Browser Supabase client (auto-generated — do not edit)
    types.ts                        # DB types (regenerated on migration)
  components/
    AppShell.tsx                    # Sidebar nav
supabase/migrations/*.sql           # Schema + single-user wipe migration
.env                                # SUPABASE_URL, VITE_SUPABASE_URL, project id
```

---

## 2. Prerequisites

1. **Node 20+** and **bun** (`npm i -g bun`) — or use `npm`/`pnpm`, but `bun.lock` is committed.
2. A **Supabase project** (free tier is fine). You need:
   - Project URL
   - `anon` / publishable key
   - Service role key (optional, only if you later add admin scripts)
3. **Lovable API key** (`LOVABLE_API_KEY`) — powers AI + Gmail/LinkedIn connectors. Get it from lovable.dev → Settings → API keys. This one key covers:
   - AI Gateway (Gemini / OpenAI models, no per-provider keys)
   - Gmail connector
   - LinkedIn connector
4. (Optional) **Cursor** — just open the folder.

---

## 3. First-time setup

```bash
bun install
cp .env.example .env   # if you make one; otherwise create .env manually (see §4)
```

### Apply the database schema

You have two options:

**A. Supabase CLI (recommended)**
```bash
npm i -g supabase
supabase link --project-ref <your-project-ref>
supabase db push          # runs everything in supabase/migrations/ in order
```

**B. Paste SQL manually**
Open Supabase Dashboard → SQL Editor. Run each file in `supabase/migrations/` in **filename order**:
1. `20260624013254_*.sql` — creates all tables (projects, tasks, source_notes, project_memory, open_loops, contacts, content_channels, content_drafts, daily_checklists) with RLS.
2. `20260624013311_*.sql` — follow-up schema tweaks.
3. `20260708011149_*.sql` — **single-user mode**: wipes data, drops `user_id` columns, disables RLS, opens `anon` grants, and seeds 4 projects (Intro, Bridger, Filibusters, Other Ideas) + 4 content channels.

After migration 3 finishes, the DB is ready. No auth users are needed.

### Regenerate TypeScript types (optional but recommended)
```bash
supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
```

---

## 4. Environment variables

Create `.env` in the project root:

```dotenv
# Supabase (public — safe to commit if you want)
VITE_SUPABASE_PROJECT_ID="xxxxxxxxxxxx"
VITE_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi...anon key..."

# Server-side mirror (used by createServerFn handlers)
SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi...anon key..."

# Lovable AI + Connectors (server-only, NEVER prefix with VITE_)
LOVABLE_API_KEY="lv_..."

# Connectors — populated automatically when you use Lovable's connector UI.
# If self-hosting, request per-service keys yourself and set:
GOOGLE_MAIL_API_KEY="..."     # Gmail connector key
LINKEDIN_API_KEY="..."        # LinkedIn connector key
```

Rules:
- Anything prefixed `VITE_` is exposed to the browser. Everything else is server-only and only read inside `createServerFn` handlers.
- Do **not** put `LOVABLE_API_KEY` behind `VITE_`.

---

## 5. Run it

```bash
bun dev          # http://localhost:8080
bun build        # production build
bun preview      # preview production build
```

Open `/home` — you should see the four seeded projects and empty checklist. No login screen.

---

## 6. How the pieces talk

```
┌────────────┐    createServerFn      ┌────────────────┐
│  React UI  │ ─────────────────────▶ │ TanStack server│
│ (routes/*) │ ◀───────────────────── │  functions     │
└────┬───────┘   JSON RPC over HTTP   └──┬─────────────┘
     │                                    │
     │ supabase-js (anon)                 │ process.env.LOVABLE_API_KEY
     ▼                                    ▼
┌────────────┐                        ┌──────────────────────┐
│  Supabase  │                        │ Lovable AI Gateway   │
│  Postgres  │                        │  + Connector Gateway │
└────────────┘                        └────┬─────────────────┘
                                           │
                                     ┌─────┴─────┐
                                     ▼           ▼
                                   Gmail      LinkedIn
```

### Server functions (all in `src/lib/*.functions.ts`)

| Function            | File                        | What it does                                                                                         |
| ------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `classifyDump`      | `ai.functions.ts`           | Sends raw text → Gemini → returns `{ classification, summary, project_id }`, writes to `source_notes` |
| `generateToday`     | `ai.functions.ts`           | Reads open tasks/notes → produces today's checklist row in `daily_checklists`                        |
| `draftPost`         | `ai.functions.ts`           | Takes a channel + topic → returns a LinkedIn draft, writes to `content_drafts`                       |
| `sendGmail`         | `integrations.functions.ts` | POSTs through connector gateway → Gmail send                                                         |
| `fetchRecentEmails` | `integrations.functions.ts` | GETs Gmail inbox list via connector                                                                  |
| `getLinkedInProfile`| `integrations.functions.ts` | GETs `/v2/me` via LinkedIn connector                                                                 |
| `publishLinkedInPost`| `integrations.functions.ts`| Publishes a UGC post via LinkedIn connector                                                          |

All server functions read `process.env.LOVABLE_API_KEY` inside the handler and hit:
- AI: `https://ai.gateway.lovable.dev/v1` (OpenAI-compatible, model: `google/gemini-3-flash-preview`)
- Connectors: `https://connector-gateway.lovable.dev/{gmail|linkedin}/...`
  - Headers: `Authorization: Bearer $LOVABLE_API_KEY` + `X-Connection-Api-Key: $GOOGLE_MAIL_API_KEY` (or `LINKEDIN_API_KEY`)

---

## 7. Integrations — what you must set up

### 7a. Lovable AI (required)
Nothing to install. Just set `LOVABLE_API_KEY` in `.env`. Model defaults live in `src/lib/ai.functions.ts` — change the model string to swap providers.

### 7b. Gmail (optional, powers `/inbox`)
- In Lovable → Connectors → Gmail → **Connect** with your Google account.
- Copy the generated `GOOGLE_MAIL_API_KEY` into `.env`.
- Test with `fetchRecentEmails()` from the `/inbox` page.

If you're **not** using Lovable's connector, rewrite `integrations.functions.ts` to call Gmail's REST API directly with your own OAuth token — the function shape stays the same, just swap the base URL and headers.

### 7c. LinkedIn (optional, powers `/content` publishing)
Same flow as Gmail:
- Connect LinkedIn in Lovable → copy `LINKEDIN_API_KEY` into `.env`.
- Or use the official LinkedIn Marketing API and swap in your own bearer token.

### 7d. Agent updates (`/agent`)
Placeholder page. When you want your external agent to push updates in, create a public webhook route:

```
src/routes/api/public/agent-updates.ts
```

with `createFileRoute` + a POST handler that verifies a shared secret and inserts into a new `agent_updates` table. Ask your agent to POST there.

---

## 8. Data model (quick reference)

- **projects** — 4 seeded (Intro, Bridger, Filibusters, Other Ideas). Holds voice/tone/audience prompts used by AI.
- **content_channels** — LinkedIn personal/company + other. Feeds `draftPost`.
- **source_notes** — everything you paste into `/dump`. AI classifies each.
- **tasks / open_loops / project_memory / contacts** — downstream tables the classifier writes to.
- **content_drafts** — AI-drafted posts awaiting your approval.
- **daily_checklists** — one row per date (unique on `date`).

All tables are RLS-disabled and open to `anon`. **Do not deploy publicly without adding a password gate** (see §10).

---

## 9. Common tasks

- **Add a new dump source**: extend the enum in `source_notes.source` and add a button in `dump.tsx`.
- **Change AI model**: edit the model string in `src/lib/ai.functions.ts`. Any OpenAI-compatible model on Lovable AI works.
- **Add a new page**: create `src/routes/_authenticated/<name>.tsx` with `createFileRoute("/_authenticated/<name>")`. Vite regenerates `routeTree.gen.ts`. Add a nav entry in `src/components/AppShell.tsx`.
- **Reset the DB**: re-run migration 3 (`TRUNCATE ... RESTART IDENTITY CASCADE`).

---

## 10. Deploying / hosting

Because auth is off, host it in **one of these three** ways:

1. **Local only** — just `bun dev` on your machine. Simplest.
2. **Personal subdomain + basic auth** — deploy to Vercel/Cloudflare Pages and put an HTTP basic-auth layer in front (Cloudflare Access, Vercel password protection, or a middleware).
3. **Add back a single shared-password gate** — one server-side password check before serving any route. Ask Lovable/Cursor to "add a shared password gate that verifies against `SITE_PASSWORD` env var" and it'll wire the middleware.

Never publish this app publicly without one of these — the DB is wide open to `anon`.

---

## 11. Troubleshooting

| Symptom                                          | Fix                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Pages stuck / dynamic import fails               | Restart Vite (`bun dev`). Client cache holds old module refs.          |
| `Missing LOVABLE_API_KEY`                        | Set it in `.env` and restart dev server.                               |
| Gmail/LinkedIn 401                               | Reconnect the connector in Lovable; copy the new key into `.env`.      |
| Postgres `permission denied for table X`         | Migration 3 didn't run. Re-run it — it grants `anon` on every table.   |
| `routeTree.gen.ts` errors                        | Don't edit it. Delete it and let Vite regenerate on next dev start.    |
| Types out of date after schema change            | `supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts` |

---

## 12. What to hand Cursor

Paste this file + the whole repo. Then prompt:

> "This is a TanStack Start + Supabase single-user app called Project HQ. Read `SETUP.md`. Confirm you can run it: check `.env` is filled in, migrations are applied, and `bun dev` starts on :8080. Then wait for my next instruction."

That's it.
