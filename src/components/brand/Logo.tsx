/** The NPL Events logo: the owner's vector artwork, white blocks with cut-out lettering (for dark backgrounds). */
export const LOGO_SRC = "/brand/NPL-Events-White.svg";

export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_SRC} alt="NPL Events" width={812} height={200} className={className} />;
}
