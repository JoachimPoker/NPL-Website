"use client";

import { type ReactNode, useState, useTransition } from "react";
import Link from "next/link";
import { bulkSetFestivalAction, bulkSetSeriesAction, bulkUpdateEventsAction } from "./actions";

export type AdminEventRow = {
  id: number;
  name: string;
  start_date: string | null;
  casino: string | null;
  buy_in: number | null;
  is_high_roller: boolean;
  series: string | null;
  series_has_festivals: boolean;
  festival_id: string | null;
  festival: string | null;
  entries: number | null;
  paid_out: number | null;
  winner: string | null;
};

type Headers = Record<"date" | "name" | "venue" | "buyin" | "cashes" | "paid", ReactNode>;

const money = (n: number | null) => (n == null ? "–" : `£${Math.round(Number(n)).toLocaleString("en-GB")}`);

export default function EventsTable({ events, removed, series, festivals, headers }: {
  events: AdminEventRow[];
  removed: boolean;
  series: { id: number; name: string }[];
  festivals: { id: string; label: string }[];
  headers: Headers;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const [festivalTarget, setFestivalTarget] = useState("");
  const [seriesTarget, setSeriesTarget] = useState("");

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = events.length > 0 && selected.length === events.length;

  const run = (label: string, fn: () => Promise<unknown>) => {
    if (!confirm(`${label} for ${selected.length} event${selected.length === 1 ? "" : "s"}?`)) return;
    start(async () => {
      try {
        await fn();
        setSelected([]);
      } catch (e: any) {
        alert(e.message);
      }
    });
  };

  return (
    <div className="panel relative overflow-hidden">
      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-primary/30 bg-base-300 px-4 py-3">
          <span className="mr-2 text-sm font-semibold">{selected.length} selected</span>
          <button className="btn btn-sm btn-outline" disabled={pending} onClick={() => run("Set High Roller", () => bulkUpdateEventsAction(selected, { is_high_roller: true }))}>
            High Roller
          </button>
          <button className="btn btn-sm btn-outline" disabled={pending} onClick={() => run("Set not High Roller", () => bulkUpdateEventsAction(selected, { is_high_roller: false }))}>
            Not High Roller
          </button>

          <span className="mx-1 h-5 w-px bg-base-content/15" />
          <select value={seriesTarget} onChange={(e) => setSeriesTarget(e.target.value)} className="select select-bordered select-sm w-44" aria-label="Series">
            <option value="">Series…</option>
            <option value="none">No series</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            className="btn btn-sm btn-outline"
            disabled={pending || !seriesTarget}
            onClick={() => run("Set series", () => bulkSetSeriesAction(selected, seriesTarget === "none" ? null : Number(seriesTarget)))}
          >
            Set series
          </button>

          <span className="mx-1 h-5 w-px bg-base-content/15" />
          <select value={festivalTarget} onChange={(e) => setFestivalTarget(e.target.value)} className="select select-bordered select-sm w-56" aria-label="Festival">
            <option value="">Festival…</option>
            {festivals.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <button
            className="btn btn-sm btn-primary"
            disabled={pending || !festivalTarget}
            onClick={() => run("Add to festival", () => bulkSetFestivalAction(selected, festivalTarget))}
          >
            Add to festival
          </button>
          <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => run("Remove from festival", () => bulkSetFestivalAction(selected, null))}>
            Remove from festival
          </button>

          <button className="btn btn-sm btn-ghost btn-square ml-auto" onClick={() => setSelected([])} aria-label="Clear selection">✕</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={`table table-sm w-full ${pending ? "pointer-events-none opacity-50" : ""}`}>
          <thead>
            <tr>
              <th className="w-10 pl-4">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={allOn}
                  onChange={() => setSelected(allOn ? [] : events.map((e) => e.id))}
                  aria-label="Select all on this page"
                />
              </th>
              <th>{headers.date}</th>
              <th>{headers.name}</th>
              <th className="hidden md:table-cell">{headers.venue}</th>
              <th className="hidden lg:table-cell">Series</th>
              <th>Festival</th>
              <th className="hidden text-right sm:table-cell">{headers.buyin}</th>
              {!removed && <th className="hidden text-right sm:table-cell">{headers.cashes}</th>}
              {!removed && <th className="pr-4 text-right">{headers.paid}</th>}
            </tr>
          </thead>
          <tbody>
            {!events.length && (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-base-content/50">No events match these filters.</td></tr>
            )}
            {events.map((e) => {
              const on = selected.includes(e.id);
              return (
                <tr key={e.id} className={`cursor-pointer transition-colors ${on ? "bg-primary/10" : "hover:bg-base-content/[0.03]"}`} onClick={() => toggle(e.id)}>
                  <td className="pl-4" onClick={(ev) => ev.stopPropagation()}>
                    <input type="checkbox" className="checkbox checkbox-xs" checked={on} onChange={() => toggle(e.id)} aria-label={`Select ${e.name}`} />
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs text-base-content/55">
                    {e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                  </td>
                  <td className="min-w-[220px]">
                    <Link href={`/admin/events/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="text-sm font-medium hover:text-primary">
                      {e.name}
                    </Link>
                    {e.is_high_roller && <span className="badge badge-secondary badge-xs ml-2 align-middle">HR</span>}
                    {e.winner && <div className="text-xs text-base-content/45">Won by {e.winner}</div>}
                  </td>
                  <td className="hidden text-sm text-base-content/70 md:table-cell">{e.casino ?? "—"}</td>
                  <td className="hidden text-sm text-base-content/70 lg:table-cell">{e.series ?? <span className="text-warning">No series</span>}</td>
                  <td className="text-sm">
                    {e.festival ? (
                      <Link href={`/admin/festivals/${e.festival_id}`} onClick={(ev) => ev.stopPropagation()} className="text-success hover:underline">
                        {e.festival}
                      </Link>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          e.series_has_festivals ? "bg-warning/15 text-warning" : "text-base-content/40"
                        }`}
                        title={e.series_has_festivals ? "Part of a festival series but not in a festival" : "Not in a festival"}
                      >
                        {e.series_has_festivals ? "Floating" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="hidden text-right font-mono text-xs sm:table-cell">{money(e.buy_in)}</td>
                  {!removed && <td className="hidden text-right font-mono text-xs sm:table-cell">{e.entries ?? "–"}</td>}
                  {!removed && <td className="pr-4 text-right font-mono text-xs">{money(e.paid_out)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
