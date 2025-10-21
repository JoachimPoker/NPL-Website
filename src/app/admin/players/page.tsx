"use client";

import { useEffect, useState } from "react";

type Player = {
  id: string;
  slug: string;
  display_name: string;
  country: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function AdminPlayersPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [editing, setEditing] = useState<Partial<Player> | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/players/list?q=${encodeURIComponent(q)}&limit=100&offset=0`, { cache: "no-store" });
      const js = await res.json();
      if (!res.ok) throw new Error(js?._error || res.statusText);
      setList(js.players || []);
      setTotal(js.total || 0);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!editing) return;
    setErr(null); setOk(null); setLoading(true);
    try {
      const res = await fetch("/api/admin/players/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing.id || null,
          display_name: editing.display_name,
          country: editing.country || null,
          is_active: editing.is_active !== false,
          notes: (editing as any).notes || null,
        }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js?._error || res.statusText);
      setOk("Saved.");
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin — Players</h1>
        <div className="flex gap-2">
          <a className="text-sm underline" href="/admin">Back to Admin</a>
          <button className="border rounded px-3 py-1" onClick={() => setEditing({ display_name: "", is_active: true })}>
            + New Player
          </button>
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-sm block">Search</label>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="name, partial match…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <button className="border rounded px-3 py-1" onClick={load} disabled={loading}>Search</button>
      </div>

      {err && <div className="p-2 bg-red-100 text-red-700 text-sm rounded">{err}</div>}
      {ok && <div className="p-2 bg-green-100 text-green-700 text-sm rounded">{ok}</div>}

      {editing && (
        <div className="border rounded p-4 space-y-3 bg-white">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm block">Display name</label>
              <input
                className="w-full border rounded px-2 py-1"
                value={editing.display_name || ""}
                onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm block">Country (optional)</label>
              <input
                className="w-full border rounded px-2 py-1"
                value={editing.country || ""}
                onChange={(e) => setEditing({ ...editing, country: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="pactive"
                type="checkbox"
                checked={editing.is_active !== false}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              <label htmlFor="pactive" className="text-sm">Active</label>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="border rounded px-3 py-1" onClick={save} disabled={loading}>Save</button>
            <button className="border rounded px-3 py-1" onClick={() => setEditing(null)} disabled={loading}>Cancel</button>
          </div>
        </div>
      )}

      <div className="border rounded bg-white overflow-x-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <b>Players</b>
          <div className="text-xs text-gray-600">{total} total</div>
        </div>
        <div className="p-4">
          {!list.length ? (
            <p className="text-sm text-gray-600">No players yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Slug</th>
                  <th className="text-left">Country</th>
                  <th className="text-left">Active</th>
                  <th className="text-left w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>{p.display_name}</td>
                    <td>{p.slug}</td>
                    <td>{p.country || "—"}</td>
                    <td>{p.is_active ? "✅" : "—"}</td>
                    <td>
                      <div className="flex gap-2">
                        <a className="border rounded px-2 py-1 text-sm" href={`/players/${p.slug}`} target="_blank">View</a>
                        <button className="border rounded px-2 py-1 text-sm" onClick={() => setEditing(p)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
