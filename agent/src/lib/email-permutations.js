// Generate likely corporate email addresses from a person's name + company domain.
// We never claim these are verified. The send step BCCs several variants so one lands.

/** Strip accents, lowercase, keep a-z only. */
function clean(part) {
  return (part || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Split a full name into { first, last }. Ignores middle names/initials. */
export function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: clean(parts[0]), last: "" };
  return { first: clean(parts[0]), last: clean(parts[parts.length - 1]) };
}

/** Normalize a domain: strip protocol, path, leading www. */
export function cleanDomain(domain) {
  if (!domain) return "";
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  return d;
}

/**
 * Ordered by rough real-world frequency. Returns up to `limit` unique guesses.
 * @param {string} fullName
 * @param {string} domain
 * @param {number} [limit]
 * @returns {string[]}
 */
export function emailPermutations(fullName, domain, limit = 7) {
  const { first, last } = splitName(fullName);
  const d = cleanDomain(domain);
  if (!d) return [];

  const fi = first.slice(0, 1);
  const li = last.slice(0, 1);

  const locals = [];
  if (first && last) {
    locals.push(
      `${first}.${last}`, // brant.johnson
      `${fi}${last}`,      // bjohnson
      `${first}${last}`,   // brantjohnson
      `${first}`,          // brant
      `${first}_${last}`,  // brant_johnson
      `${fi}.${last}`,     // b.johnson
      `${first}${li}`,     // brantj
      `${last}`,           // johnson
      `${last}.${first}`,  // johnson.brant
    );
  } else if (first) {
    locals.push(first);
  }

  const seen = new Set();
  const out = [];
  for (const l of locals) {
    if (!l || seen.has(l)) continue;
    seen.add(l);
    out.push(`${l}@${d}`);
    if (out.length >= limit) break;
  }
  return out;
}
