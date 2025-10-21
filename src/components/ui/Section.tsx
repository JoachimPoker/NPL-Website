// src/components/ui/Section.tsx
export default function Section({
  title,
  right,
  children,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="card-header flex flex-wrap items-center justify-between gap-2 sticky top-[57px] z-10 bg-neutral-50/80 backdrop-blur">
        <div>{title}</div>
        {right ? <div className="text-sm">{right}</div> : null}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
