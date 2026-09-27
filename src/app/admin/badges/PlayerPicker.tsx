"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabaseClient";

type Option = { id: number; forename: string | null; surname: string | null };

/** Search players by name (or type an id); submits the chosen player's id as `name`. */
export default function PlayerPicker({ name = "player_id" }: { name?: string }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [picked, setPicked] = useState<Option | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (picked || term.length < 2) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const db = createSupabaseClient();
      let query = db.from("players").select("id, forename, surname").limit(8);
      if (/^\d+$/.test(term)) query = query.eq("id", Number(term));
      else {
        const [first, ...rest] = term.split(/\s+/);
        query = rest.length
          ? query.ilike("forename", `${first}%`).ilike("surname", `${rest.join(" ")}%`)
          : query.or(`forename.ilike.${first}%,surname.ilike.${first}%`);
      }
      const { data } = await query.order("surname");
      setOptions((data as Option[]) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={picked?.id ?? ""} />
      <input
        value={picked ? `${picked.forename ?? ""} ${picked.surname ?? ""} (#${picked.id})` : q}
        onChange={(e) => { setPicked(null); setQ(e.target.value); }}
        placeholder="Search player name or id…"
        className="input input-bordered input-sm w-full"
        aria-label="Player"
        autoComplete="off"
      />
      {options.length > 0 && (
        <ul className="panel absolute z-20 mt-1 w-full overflow-hidden">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => { setPicked(o); setOptions([]); }}
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-base-200"
              >
                <span>{o.forename} {o.surname}</span>
                <span className="font-mono text-xs opacity-50">#{o.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
