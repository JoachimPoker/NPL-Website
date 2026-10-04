"use client";

import { useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type Option = { id: number; name: string };

/** Pick a player for one side of the comparison; updates ?a= / ?b= in the URL. */
export default function PlayerSearch({ side, label }: { side: "a" | "b"; label: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const listId = useId();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [active, setActive] = useState(-1);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        // Public search: only players who allow their name to be shown can be found.
        const res = await fetch(`/api/players?q=${encodeURIComponent(term)}&pageSize=8`, { signal: ctrl.signal });
        const json = await res.json();
        setOptions((json.rows || []).map((r: any) => ({ id: r.id, name: r.name })));
        setActive(-1);
      } catch {}
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);
  // Fewer than two letters: no suggestions (old results are hidden rather than cleared).
  const shown = term.length < 2 ? [] : options;

  function pick(id: number) {
    const next = new URLSearchParams(params.toString());
    next.set(side, String(id));
    setQ("");
    setOptions([]);
    router.push(`/compare?${next}`);
  }

  const open = shown.length > 0;

  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-season-muted" aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(shown[active].id); }
          else if (e.key === "Escape") setOptions([]);
        }}
        placeholder={label}
        aria-label={`${label} (${side === "a" ? "first" : "second"} player)`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="h-12 w-full rounded-[3px] border border-white/[0.14] bg-season-night/70 pl-11 pr-4 text-[1rem] text-season-ink caret-season-amber placeholder:text-season-muted transition-colors hover:border-white/25 focus:border-season-amber/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-season-amber"
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-[3px] border border-white/[0.14] bg-[#0b2629] text-left">
          {shown.map((o, i) => (
            <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => pick(o.id)}
                className={`block w-full px-4 py-3 text-left text-[1rem] text-season-ink transition-colors hover:bg-white/[0.06] ${i === active ? "bg-season-amber/[0.12]" : ""}`}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
