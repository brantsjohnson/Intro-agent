# Intro Outreach Agent

A Node.js CLI that finds business events, extracts organizers + sponsors, resolves contacts, and sends outreach from **your own Gmail account** (Gmail API OAuth2 — replies land in your normal inbox).

No UI. Run manually first, schedule later. Every send requires terminal confirmation in v1.

---

## Build order (do NOT skip)

Build and test each step in isolation before wiring `run.js`:

1. `discover-events.js` — Eventbrite + web search → normalized events.
2. `extract-event-details.js` — fetch event page + sponsors/about pages → Claude → strict JSON.
3. `resolve-contacts.js` — pluggable: site scrape first, paid enrichment (Hunter/Clay) as a stub.
4. `gmail-auth.js` — Google Cloud OAuth2 flow (Desktop app), `token.json` persisted.
5. `compose-email.js` — Claude drafts using positioning tracks (see below). No em dashes. ≤120 words.
6. `send-email.js` — Gmail API send + `sent-log.sqlite` de-dup.
7. `run.js` — end-to-end, batched per event, y/n confirmation before every send.

Test with one real event URL first. Get output right before moving on.

---

## Required config (see `.env.example`)

- `ANTHROPIC_API_KEY` — Claude for extraction + drafting.
- `EVENTBRITE_API_KEY` — optional; discovery falls back to web search if absent.
- `HUNTER_API_KEY` — optional; enrichment fallback.
- `GMAIL_SEND_AS` — your main Gmail or a configured "Send As" alias.
- `OUTREACH_INDUSTRIES`, `OUTREACH_DATE_FROM`, `OUTREACH_DATE_TO`, `OUTREACH_REGIONS` — outreach filters.

Google OAuth2 credentials live in `credentials.json` (not `.env`). See `gmail-auth.js` for the walkthrough.

---

## Quick start

```bash
cd agent
npm install
cp .env.example .env         # fill in keys
node gmail-auth.js           # one-time browser auth → writes token.json
node run.js                  # dry-run preview + y/n before each send
```

Individual steps:

```bash
node discover-events.js
node extract-event-details.js https://someconference.com/2026
node resolve-contacts.js "Acme Corp" "Head of Partnerships"
node compose-email.js sponsor "Acme Corp" "Jane Doe" "SaaSFest 2026"
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

1. Which Gmail address / alias to send from.
2. Industries, date range, and regions for the outreach filter.
3. Anthropic and Eventbrite keys.
4. Whether I've done the Google Cloud OAuth setup yet (walk me through if not).

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
    gmail-auth.js
    compose-email.js
    send-email.js
    lib/
      claude.js             # thin Anthropic wrapper (strict JSON mode helper)
      fetch-page.js         # HTML fetch + readable text + link extraction
      log.js                # sent-log.sqlite helpers, dedup by (event, email)
      prompt.js             # terminal y/n prompt
  run.js
```
