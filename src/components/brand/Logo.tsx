/** The NPL Events logo (white artwork, for the site's dark backgrounds). */
export const LOGO_SRC = "/brand/npl-events.png";

export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_SRC} alt="NPL Events" width={813} height={201} className={className} />;
}
