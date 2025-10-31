// src/lib/nameMask.ts
export function initials(forename?: string | null, surname?: string | null) {
  const f = (forename || "").trim();
  const s = (surname || "").trim();
  if (!f && !s) return "Anonymous";
  const fi = f ? f[0].toUpperCase() + "." : "";
  const si = s ? s[0].toUpperCase() + "." : "";
  return `${fi}${fi && si ? " " : ""}${si}`.trim() || "Anonymous";
}

export function displayName(
  forename?: string | null,
  surname?: string | null,
  consent?: boolean,
  display_name?: string | null
) {
  if (!consent) return initials(forename, surname);
  const name =
    (display_name && display_name.trim()) ||
    [forename, surname].filter(Boolean).join(" ").trim();
  return name || "Anonymous";
}
