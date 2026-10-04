/** A section heading with a fine rule running out to the right. */
export default function RuledHeading({ id, children, as: Tag = "h2" }: { id?: string; children: React.ReactNode; as?: "h2" | "h3" }) {
  return (
    <div className="flex items-center gap-5">
      <Tag id={id} className="min-w-0 text-[clamp(1.5rem,2vw,1.875rem)] font-semibold leading-tight">{children}</Tag>
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-white/[0.12]" />
    </div>
  );
}
