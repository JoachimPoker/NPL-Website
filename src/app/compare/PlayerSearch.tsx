"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

type Option = { id: number; name: string };

/** Pick a player for one side of the comparison; updates ?a= / ?b= in the URL. */
export default function PlayerSearch({ side, label }: { side: "a" | "b"; label: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        // Public search: only players who allow their name to be shown can be found.
        const res = await fetch(`/api/players?q=${encodeURIComponent(term)}&pageSize=8`, { signal: ctrl.signal });
        const json = await res.json();
        setOptions((json.rows || []).map((r: any) => ({ id: r.id, name: r.name })));
      } catch {}
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  function pick(id: number) {
    const next = new URLSearchParams(params.toString());
    next.set(side, String(id));
    setQ("");
    setOptions([]);
    router.push(`/compare?${next}`);
  }

  return (
    <div className="relative">
      <label className="input w-full bg-base-100">
        <Search size={16} className="text-base-content/40" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={label}
          aria-label={label}
          autoComplete="off"
        />
      </label>
      {options.length > 0 && (
        <ul className="panel absolute z-20 mt-1 w-full overflow-hidden p-0">
          {options.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => pick(o.id)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-base-content/[0.05]">
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
