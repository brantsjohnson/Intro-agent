// HTML email signature matching Brant's Gmail signature (photo + links).
// Photo is hosted on HQ so clients can load it: /signature/brant.jpg

const PHOTO_URL =
  process.env.SIGNATURE_PHOTO_URL ||
  "https://hq.brantsjohnson.com/signature/brant.jpg";

const LINKEDIN_URL =
  process.env.SIGNATURE_LINKEDIN_URL ||
  "https://www.linkedin.com/in/brantjohnson";

/**
 * Escape text for HTML bodies.
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn a plain-text email body into simple HTML paragraphs. */
export function plainBodyToHtml(body) {
  const escaped = escapeHtml(body).trim();
  const paragraphs = escaped
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return paragraphs;
}

/** Full HTML signature block (table layout for email clients). */
export function signatureHtml() {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-collapse:collapse;">
  <tr>
    <td style="vertical-align:middle;padding-right:14px;">
      <img src="${PHOTO_URL}" width="72" height="72" alt="Brant Johnson" style="border-radius:50%;display:block;border:0;" />
    </td>
    <td style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:#555;">
      <div style="margin:0;">
        <span style="font-weight:700;color:#111;">Brant Johnson</span>
        <span style="color:#bbb;padding:0 6px;">|</span>
        <span style="color:#777;">Founder</span>
      </div>
      <div style="margin:2px 0 0;">
        <a href="mailto:brant@intro.events" style="color:#777;text-decoration:none;">brant@intro.events</a>
        <span style="color:#bbb;padding:0 6px;">|</span>
        <a href="tel:+14357903043" style="color:#777;text-decoration:none;">(435) 790-3043</a>
      </div>
      <div style="margin:2px 0 0;">
        <a href="https://intro.events" style="color:#9a7b4f;text-decoration:none;">intro.events</a>
        <span style="color:#bbb;padding:0 6px;">|</span>
        <a href="${LINKEDIN_URL}" style="color:#9a7b4f;text-decoration:none;">LinkedIn</a>
      </div>
    </td>
  </tr>
</table>`.trim();
}

/** Wrap outreach plain body + signature into a full HTML email. */
export function buildHtmlEmail(plainBody) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;">
${plainBodyToHtml(plainBody)}
${signatureHtml()}
</body></html>`;
}

/** Plain-text fallback signature (for clients that strip HTML). */
export function signaturePlain() {
  return [
    "",
    "Brant Johnson | Founder",
    "brant@intro.events | (435) 790-3043",
    "intro.events | LinkedIn",
  ].join("\n");
}
