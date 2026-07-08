# Integrations (n8n + Anthropic)

This project no longer depends on Lovable. AI runs on Anthropic Claude, and all
Gmail + LinkedIn actions go through **your self-hosted n8n**. n8n holds the OAuth
connections to Google and LinkedIn, so this app never touches those tokens.

```
Web app (Vercel)  ─┐
                   ├─ HTTPS POST ─▶  n8n webhook ─▶ Gmail / LinkedIn
Agent CLI (local) ─┘                 (your creds)
```

The app and agent send a shared secret header `x-webhook-secret`. Your n8n
workflow should reject any request whose header does not match.

---

## 1. Self-hosting n8n for free

n8n is source-available and free to self-host. It just needs a **public HTTPS
URL** so Vercel (and the agent) can reach its webhooks.

Options, cheapest first:

- **Local + tunnel (fastest to try):**
  ```bash
  npx n8n            # starts n8n on http://localhost:5678
  ```
  For a public URL while testing, run it with n8n's built-in tunnel:
  ```bash
  npx n8n start --tunnel
  ```
  Good for development. The tunnel URL is not stable long-term.

- **Docker (recommended for something that stays up):**
  ```bash
  docker run -d --restart unless-stopped --name n8n \
    -p 5678:5678 \
    -e N8N_HOST=your-domain \
    -e WEBHOOK_URL=https://your-domain \
    -v n8n_data:/home/node/.n8n \
    docker.n8n.io/n8nio/n8n
  ```
  Put it behind any reverse proxy that gives you HTTPS (Caddy, Cloudflare Tunnel,
  a Fly.io / Railway / Render container, or an Oracle Cloud always-free VM).

- **Free-ish hosts:** Fly.io and Oracle Cloud have free allowances that fit a
  single small n8n container. Render's free tier sleeps, which is fine for the
  agent (manual runs) but not ideal for the inbox page.

Once n8n has a public URL, each workflow's **Production URL** looks like
`https://<your-n8n-host>/webhook/<path>`.

---

## 2. Workflows to build

Create these workflows in n8n. Each starts with a **Webhook** node (HTTP method
POST, "Respond" = "Using Respond to Webhook node" so you can return JSON), then
does the action, then a **Respond to Webhook** node returning the JSON below.
In the Webhook node, gate on the header `x-webhook-secret`.

### a) Gmail send  →  `N8N_GMAIL_SEND_URL` (and agent `N8N_EMAIL_SEND_URL`)

Request body:
```json
{ "to": "jane@acme.com", "toName": "Jane Doe", "from": "you@gmail.com", "subject": "…", "body": "plain text", "asDraft": false }
```
Node: Gmail → Send a message (or Create draft when `asDraft` is true).
Respond:
```json
{ "id": "<gmail message id>" }
```

### b) Gmail fetch recent  →  `N8N_GMAIL_FETCH_URL`

Request body:
```json
{ "query": "is:unread newer_than:7d", "max": 15 }
```
Node: Gmail → Get many messages (apply the query).
Respond with an array (the app also accepts `{ "messages": [...] }`):
```json
[ { "id": "…", "from": "…", "subject": "…", "date": "…", "snippet": "…" } ]
```

### c) LinkedIn personal post  →  `N8N_LINKEDIN_PERSONAL_URL`

Request body:
```json
{ "text": "post body" }
```
Node: LinkedIn → Create post (as the authenticated person).
Respond:
```json
{ "id": "<post urn>", "url": "https://www.linkedin.com/feed/update/<urn>" }
```

### d) LinkedIn company post  →  `N8N_LINKEDIN_COMPANY_URL`

Same request/response as personal, but the LinkedIn node posts **as the
Organization** (your company page). This requires the LinkedIn app to have the
organization posting permission and you to be an admin of the page.

---

## 3. Where the URLs go

Web app (local `.env` and Vercel env for both Production and Preview):

| Env var                     | Webhook            |
| --------------------------- | ------------------ |
| `N8N_GMAIL_SEND_URL`        | (a) Gmail send     |
| `N8N_GMAIL_FETCH_URL`       | (b) Gmail fetch    |
| `N8N_LINKEDIN_PERSONAL_URL` | (c) LinkedIn person|
| `N8N_LINKEDIN_COMPANY_URL`  | (d) LinkedIn company|
| `N8N_WEBHOOK_SECRET`        | your shared secret |

Agent (`agent/.env`):

| Env var               | Webhook                                   |
| --------------------- | ----------------------------------------- |
| `N8N_EMAIL_SEND_URL`  | (a) Gmail send (same URL is fine)         |
| `N8N_WEBHOOK_SECRET`  | same shared secret                        |
| `GMAIL_SEND_AS`       | the address n8n should send from          |

Add the web app vars to Vercel with:
```bash
vercel env add N8N_GMAIL_SEND_URL production
# repeat for preview and the other N8N_* vars, then redeploy:
vercel --prod
```

---

## 4. AI (Anthropic)

`ANTHROPIC_API_KEY` powers `classifyDump`, `generateToday`, and `draftPost`
(`src/lib/ai.functions.ts`). Models: `claude-haiku-4-5` for classification,
`claude-sonnet-4-5` for the daily plan and post drafts. Swap model names there
if you want.
