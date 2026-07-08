// Step 4: Gmail API OAuth2 (Desktop app).
// Replies land in your normal Gmail inbox because this uses YOUR Gmail account.
//
// One-time setup (walk through in terminal):
//   1. https://console.cloud.google.com/ → create/select a project.
//   2. APIs & Services → Library → enable "Gmail API".
//   3. APIs & Services → OAuth consent screen → External → add yourself as a test user.
//      Scopes: https://www.googleapis.com/auth/gmail.send  (and gmail.settings.basic if using Send As).
//   4. Credentials → Create Credentials → OAuth Client ID → Desktop app.
//   5. Download JSON → save as ./credentials.json (path from GOOGLE_CREDENTIALS_PATH).
//   6. Run `node src/gmail-auth.js` → browser opens → approve → token.json written.
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { URL } from "node:url";
import open from "open";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.settings.basic", // for enumerating Send As aliases
];

const CRED_PATH = process.env.GOOGLE_CREDENTIALS_PATH || "./credentials.json";
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || "./token.json";

export async function loadAuthorizedClient() {
  const creds = JSON.parse(await readFile(CRED_PATH, "utf8"));
  const cfg = creds.installed || creds.web;
  if (!cfg) throw new Error(`${CRED_PATH} is not a Desktop OAuth client credentials file.`);

  const oAuth2 = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, "http://127.0.0.1:53682/oauth2callback");

  try {
    const token = JSON.parse(await readFile(TOKEN_PATH, "utf8"));
    oAuth2.setCredentials(token);
    return oAuth2;
  } catch {
    // fall through to interactive
  }

  const authUrl = oAuth2.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
  const code = await captureCode(authUrl);
  const { tokens } = await oAuth2.getToken(code);
  oAuth2.setCredentials(tokens);
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`✓ token saved to ${TOKEN_PATH}`);
  return oAuth2;
}

function captureCode(authUrl) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1:53682");
      if (u.pathname !== "/oauth2callback") {
        res.writeHead(404).end();
        return;
      }
      const code = u.searchParams.get("code");
      const err = u.searchParams.get("error");
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<h2>${err ? "Auth failed" : "You can close this tab."}</h2>`);
      server.close();
      err ? reject(new Error(err)) : resolve(code);
    });
    server.listen(53682, "127.0.0.1", () => {
      console.log(`Opening browser for Gmail auth...\nIf it doesn't open, paste this URL:\n${authUrl}\n`);
      open(authUrl).catch(() => {});
    });
    server.on("error", reject);
  });
}

/** List "Send As" aliases the account has configured. */
export async function listSendAs(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.settings.sendAs.list({ userId: "me" });
  return (data.sendAs || []).map((s) => ({
    address: s.sendAsEmail,
    isPrimary: !!s.isPrimary,
    isDefault: !!s.isDefault,
    displayName: s.displayName || null,
    verified: s.verificationStatus === "accepted" || s.isPrimary,
  }));
}

// CLI: `node src/gmail-auth.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const auth = await loadAuthorizedClient();
  const aliases = await listSendAs(auth);
  console.log("Send As addresses on this account:");
  console.table(aliases);
  const chosen = process.env.GMAIL_SEND_AS;
  if (chosen && !aliases.some((a) => a.address.toLowerCase() === chosen.toLowerCase())) {
    console.warn(`⚠ GMAIL_SEND_AS=${chosen} is not on this account. Add it in Gmail Settings → Accounts → Send mail as.`);
  } else if (chosen) {
    console.log(`✓ Will send as: ${chosen}`);
  }
}
