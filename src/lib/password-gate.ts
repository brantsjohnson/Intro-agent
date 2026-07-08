// Shared single-password gate. The Supabase DB is open to `anon`, so the deployed
// site must sit behind one password before any route is served (see SETUP.md section 10).
//
// Enabled only when SITE_PASSWORD is set, so local dev stays frictionless.
// Returns a Response to short-circuit the request, or null to let it through.

const COOKIE_NAME = "hq_auth";
const LOGIN_PATH = "/__auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith("/assets/") || pathname.startsWith("/_build/")) return true;
  return /\.(css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|txt|json|xml|webmanifest)$/i.test(
    pathname,
  );
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function expectedToken(password: string): Promise<string> {
  // Namespaced so the cookie value never equals the raw password.
  return sha256Hex(`hq-gate:${password}`);
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function loginPage(nextPath: string, error = false): Response {
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Project HQ</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#faf8f4; color:#1a1a1a; font-family:Inter,system-ui,-apple-system,sans-serif; }
  .card { width:100%; max-width:340px; padding:32px; }
  h1 { font-family:Fraunces,Georgia,serif; font-size:32px; margin:0 0 4px; }
  p { color:#6b6b6b; font-size:14px; margin:0 0 24px; }
  input { width:100%; padding:12px 14px; border:1px solid #ddd8cf; border-radius:8px;
    font-size:15px; background:#fff; margin-bottom:12px; }
  input:focus { outline:none; border-color:#1a1a1a; }
  button { width:100%; padding:12px 14px; border:0; border-radius:8px; background:#1a1a1a;
    color:#faf8f4; font-size:15px; font-weight:600; cursor:pointer; }
  .err { color:#b91c1c; font-size:13px; margin-bottom:12px; }
</style>
</head>
<body>
  <form class="card" method="POST" action="${LOGIN_PATH}">
    <h1>Project HQ</h1>
    <p>Enter the password to continue.</p>
    ${error ? '<div class="err">Wrong password. Try again.</div>' : ""}
    <input type="hidden" name="next" value="${safeNext.replace(/"/g, "&quot;")}" />
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password" />
    <button type="submit">Enter</button>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function passwordGate(request: Request): Promise<Response | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null; // Gate disabled (e.g. local dev).

  const url = new URL(request.url);
  const token = await expectedToken(password);

  // Handle login submissions and logout.
  if (url.pathname === LOGIN_PATH) {
    if (request.method === "POST") {
      const form = await request.formData();
      const submitted = String(form.get("password") ?? "");
      const next = String(form.get("next") ?? "/");
      const safeNext = next.startsWith("/") ? next : "/";
      if (submitted && submitted === password) {
        const secure = url.protocol === "https:" ? " Secure;" : "";
        return new Response(null, {
          status: 303,
          headers: {
            location: safeNext,
            "set-cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${COOKIE_MAX_AGE}`,
          },
        });
      }
      return loginPage(safeNext, true);
    }
    if (url.pathname === LOGIN_PATH && url.searchParams.get("logout") !== null) {
      return new Response(null, {
        status: 303,
        headers: {
          location: "/",
          "set-cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        },
      });
    }
    return loginPage("/");
  }

  // Let static assets through so the login page can style itself.
  if (isStaticAsset(url.pathname)) return null;

  const cookies = parseCookies(request.headers.get("cookie"));
  if (cookies[COOKIE_NAME] && timingSafeEqual(cookies[COOKIE_NAME], token)) {
    return null; // Authenticated.
  }

  return loginPage(url.pathname + url.search);
}
