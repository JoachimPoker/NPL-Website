// src/components/ui/Table.tsx
export function Table({
  head,
  children,
  stickyHeader = true,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  stickyHeader?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead className={stickyHeader ? "sticky top-[98px]" : ""}>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
