"use client";

import { useEffect, useState } from "react";

type Match = { id: number; tournament_name: string | null; casino: string | null; start_date: string | null };

/** Pattern input with a live preview of matching event names. */
export default function PatternField({ defaultValue }: { defaultValue: string }) {
  const [pattern, setPattern] = useState(defaultValue);
  const [result, setResult] = useState<{ count: number; examples: Match[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pattern.trim()) {
      setResult(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/series/test-pattern?pattern=${encodeURIComponent(pattern)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Test failed");
        setResult(json);
        setError(null);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setError(e.message);
          setResult(null);
        }
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pattern]);

  return (
    <div className="form-control">
      <span className="label-text mb-1 text-xs font-bold">Name pattern</span>
      <input
        name="match_pattern"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        className="input input-bordered input-sm font-mono"
        placeholder="e.g. ^GUKPT\M|^Online\W+Closer\W+GUKPT"
      />
      <p className="mt-1 text-[11px] text-base-content/50">
        Case-insensitive. <code>^</code> = starts with, <code>|</code> = or, <code>\M</code> = end of word. Leave empty to
        assign events to this series by hand only.
      </p>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
      {result && (
        <div className="mt-2 rounded-lg bg-base-200/50 p-3 text-xs">
          <div className="font-bold">
            Matches {result.count} event{result.count === 1 ? "" : "s"}
            <span className="font-normal opacity-60"> (events matching an earlier series in the list stay there)</span>
          </div>
          <ul className="mt-1 space-y-0.5 opacity-70">
            {result.examples.map((m) => (
              <li key={m.id} className="truncate">
                {m.tournament_name} <span className="opacity-60">· {m.casino}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
