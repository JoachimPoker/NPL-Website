// src/lib/legal.ts
// Who runs the site, used by the privacy notice, terms and contact page. Fill these in before launch:
// the privacy notice must name who is responsible for the data (the "controller") and how to reach them.
// Anything left null is simply left out of the pages; the admin dashboard lists what is still missing.

export const LEGAL = {
  /** The person or company that runs the site, e.g. "Example Ltd" or a full name. */
  operatorName: null as string | null,
  /** For a company: registered number and registered office (required on a UK company's website). */
  companyNumber: null as string | null,
  registeredAddress: null as string | null,
  /** An email for privacy and data requests (the contact form works without it). */
  email: null as string | null,
  /** ICO data protection registration number, once registered. */
  icoRegistration: null as string | null,
  /** When these pages were last reviewed. */
  lastUpdated: "4 October 2026",
};

export const LEGAL_MISSING = (
  [
    ["operatorName", "who runs the site"],
    ["email", "a contact email for data requests"],
    ["icoRegistration", "the ICO registration number"],
  ] as const
)
  .filter(([k]) => !LEGAL[k])
  .map(([, label]) => label);

export const LEGAL_LINKS = [
  { label: "Privacy & cookies", href: "/privacy" },
  { label: "Terms of use", href: "/terms" },
  { label: "Safer gambling", href: "/safer-gambling" },
  { label: "Accessibility", href: "/accessibility" },
  { label: "Contact", href: "/contact" },
];
