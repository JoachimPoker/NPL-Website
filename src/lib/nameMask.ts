// src/lib/nameMask.ts

/** Some imported names arrive HTML-escaped ("O&apos;Hara"); show them as written. */
export function decodeEntities(s: string) {
  return s
    .replace(/&(apos|#0*39);/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** A name part is only usable if it has at least one letter (reports sometimes contain "." or "-"). */
function clean(part?: string | null) {
  const t = decodeEntities(part || "").trim();
  return /\p{L}/u.test(t) ? t : "";
}

export function initials(forename?: string | null, surname?: string | null) {
  const f = clean(forename);
  const s = clean(surname);
  if (!f && !s) return "Unknown player";
  const fi = f ? f[0].toUpperCase() + "." : "";
  const si = s ? s[0].toUpperCase() + "." : "";
  return `${fi}${fi && si ? " " : ""}${si}`.trim();
}

export function displayName(
  forename?: string | null,
  surname?: string | null,
  consent?: boolean,
  display_name?: string | null
) {
  if (!consent) return initials(forename, surname);
  const name = clean(display_name) || [clean(forename), clean(surname)].filter(Boolean).join(" ");
  return name || "Unknown player";
}
