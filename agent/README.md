# Intro Outreach Agent

A Node.js CLI that finds business events, extracts organizers + sponsors, resolves contacts, and sends outreach from **your own Gmail account via a self-hosted n8n webhook** (n8n owns the Gmail OAuth, so replies land in your normal inbox).

No UI. Run manually first, schedule later. Every send requires terminal confirmation in v1.

---

## Build order (do NOT skip)

Build and test each step in isolation before wiring `run.js`:

1. `discover-events.js` — single event URL scrape (schema.org / OpenGraph) or Eventbrite + web search → normalized events.
2. `extract-event-details.js` — fetch event page + sponsors/about pages → Claude → strict JSON.
3. `resolve-contacts.js` — pluggable: site scrape first, paid enrichment (Hunter/Clay) as a stub.
4. `compose-email.js` — Claude drafts using positioning tracks (see below). No em dashes. ≤120 words.
5. `send-email.js` — POSTs to the n8n Gmail-send webhook + `sent-log.sqlite` de-dup.
6. `run.js` — end-to-end, batched per event, y/n confirmation before every send.

Email sending goes through n8n rather than the Gmail API directly, so there is no Google Cloud OAuth setup. Stand up an n8n workflow with a Webhook trigger + a Gmail "Send" node, and put its URL in `N8N_EMAIL_SEND_URL`.

Test with one real event URL first. Get output right before moving on.

---

## Required config (see `.env.example`)

- `ANTHROPIC_API_KEY` — Claude for extraction + drafting.
- `N8N_EMAIL_SEND_URL` — your n8n Gmail-send webhook (can be the same workflow the web app uses).
- `N8N_WEBHOOK_SECRET` — shared secret sent as `x-webhook-secret`; verify it inside the n8n workflow.
- `GMAIL_SEND_AS` — your main Gmail or a configured "Send As" alias (passed to n8n as `from`).
- `TAVILY_API_KEY` — optional web search for discovery. Not needed for single-URL runs.
- `EVENTBRITE_API_KEY` — optional; discovery falls back to web search if absent.
- `HUNTER_API_KEY` — optional; enrichment fallback.
- `OUTREACH_INDUSTRIES`, `OUTREACH_DATE_FROM`, `OUTREACH_DATE_TO`, `OUTREACH_REGIONS` — outreach filters.

---

## Quick start

```bash
cd agent
npm install
cp .env.example .env         # fill in keys
node run.js                  # dry-run preview + y/n before each send
```

Individual steps:

```bash
node src/discover-events.js https://someconference.com/2026
node src/extract-event-details.js https://someconference.com/2026
node src/resolve-contacts.js "Acme Corp" "Head of Partnerships"
node src/compose-email.js sponsor "Acme Corp" "Jane Doe" "SaaSFest 2026"
```

---

## Email positioning (used by `compose-email.js`)

**Product**: Intro.

- **Sponsors**: Intro helps sponsors generate and prove more value from every event sponsorship.
- **Organizers**: Intro helps event organizers create better event outcomes and prove their events were worth the investment.

### Track 1 — Sponsor emails
Audience: marketing / partnerships / events lead at a sponsoring company. They pay real money and get a badge-scan spreadsheet. They don't know which conversations happened, whether they met the right people, or whether it's worth renewing.

Intro: helps attendees discover the sponsor when relevant, introduces qualified people, shows what sponsorship actually produced. Benefits (pick 1-2): higher-quality conversations, warm intros to fit-attendees, more booth engagement, better lead quality, ROI analytics, easier budget justification.

Angle: they're already paying, they deserve to know what it produced. Soft ask: gauge interest, suggest they mention Intro to the organizer (organizer is the buyer).

### Track 2 — Organizer emails
Audience: event director / head of events / founder. Their event only succeeds if attendees meet valuable people, sponsors see ROI, speakers reach the right audience, people return.

Intro: guides attendees to meaningful conversations, gives sponsors measurable ROI, gives the organizer analytics on what happened. Benefits (pick 1-2): better attendee experience, sponsor retention via measurable outcomes, real metrics (conversations, meetings, intros), higher renewal rates.

Angle: if the event has visible sponsors, note that sponsors are increasingly asking for measurable ROI — Intro solves that plus attendee experience in one platform. Observational, not pushy.

### Tone rules (all generated emails)
- Plain text. No HTML, images, or formatting tricks.
- **No em dashes, ever.**
- Short sentences. Everyday words.
- One clear ask, easy to say no to.
- Reference something specific about the event or company.
- Sign off with just my name.
- Subject line under 8 words. No `!`. No "quick question" clichés.

---

## What Cursor should ask me before running live

1. Which Gmail address / alias to send from (`GMAIL_SEND_AS`).
2. Industries, date range, and regions for the outreach filter.
3. Anthropic key (and optional Tavily/Eventbrite keys).
4. The n8n Gmail-send webhook URL + shared secret.

---

## Files

```
agent/
  package.json
  .env.example
  .gitignore
  README.md                 # this file
  src/
    discover-events.js
    extract-event-details.js
    resolve-contacts.js
    compose-email.js
    send-email.js
    lib/
      claude.js             # thin Anthropic wrapper (strict JSON mode helper)
      fetch-page.js         # HTML fetch + readable text + link extraction
      log.js                # sent-log.sqlite helpers, dedup by (event, email)
      prompt.js             # terminal y/n prompt
  run.js
```
