// src/app/admin/seasons/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Season = {
  id?: number;
  label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  method: "ALL" | "BEST_X";
  cap_x: number | null;
  notes: string | null;
  prize_bands: Array<{ from: number; to: number; text: string }>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ListResp = { seasons: Season[]; _error?: string };

const emptySeason: Season = {
  label: "",
  start_date: "",
  end_date: "",
  method: "ALL",
  cap_x: null,
  notes: "",
  prize_bands: [],
  is_active: false,
};

export default function AdminSeasonsPage() {
  const [list, setList] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/seasons/list", { cache: "no-store" });
      const json = (await res.json()) as ListResp;
      if (!res.ok) throw new Error(json._error || res.statusText);
      setList(json.seasons || []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

  const startCreate = () => {
    setEditing({ ...emptySeason });
    setOk(null);
    setErr(null);
  };

  const startEdit = (s: Season) => {
    // deep clone to avoid mutating list while editing
    setEditing(JSON.parse(JSON.stringify(s)));
    setOk(null);
    setErr(null);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const save = async () => {
    if (!editing) return;
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const body = {
        id: editing.id ?? null,
        label: editing.label.trim(),
        start_date: editing.start_date,
        end_date: editing.end_date,
        method: editing.method,
        cap_x: editing.method === "BEST_X" ? Number(editing.cap_x || 20) : null,
        notes: editing.notes || "",
        prize_bands: (editing.prize_bands || []).map((b) => ({
          from: Number(b.from),
          to: Number(b.to ?? b.from),
          text: String(b.text || "").trim(),
        })),
        is_active: !!editing.is_active,
      };
      const res = await fetch("/api/admin/seasons/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json._error || res.statusText);
      setOk("Saved.");
      setEditing(null);
      fetchList();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const setActive = async (id: number) => {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/seasons/set-active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json._error || res.statusText);
      setOk("Active season updated.");
      fetchList();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this season?")) return;
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/seasons/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json._error || res.statusText);
      setOk("Deleted.");
      fetchList();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Prize bands helpers
  const addBand = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      prize_bands: [...(editing.prize_bands || []), { from: 1, to: 1, text: "" }],
    });
  };

  const updateBand = (
    idx: number,
    patch: Partial<{ from: number; to: number; text: string }>
  ) => {
    if (!editing) return;
    const next = [...(editing.prize_bands || [])];
    next[idx] = { ...next[idx], ...patch } as any;
    setEditing({ ...editing, prize_bands: next });
  };

  const removeBand = (idx: number) => {
    if (!editing) return;
    const next = [...(editing.prize_bands || [])];
    next.splice(idx, 1);
    setEditing({ ...editing, prize_bands: next });
  };

  const activeId = useMemo(() => list.find((s) => s.is_active)?.id, [list]);

  return (
    <div className="space-y-6">
      {/* Local toolbar (main header is provided by /admin/layout.tsx) */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600 dark:text-neutral-300">
          Define season windows, scoring method and prize bands.
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border px-3 py-1.5 text-sm"
            onClick={startCreate}
            disabled={!!editing}
          >
            + New Season
          </button>
          <button
            className="rounded-md border px-3 py-1.5 text-sm"
            onClick={fetchList}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="p-2 rounded bg-red-100 text-red-700 text-sm">{err}</div>}
      {ok && <div className="p-2 rounded bg-green-100 text-green-700 text-sm">{ok}</div>}

      {/* Editor */}
      {editing && (
        <div className="card p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Label</label>
              <input
                className="w-full border rounded px-2 py-1"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="Season 8"
              />
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                />
                <span className="text-sm">Set Active</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium">Start Date</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1"
                value={editing.start_date}
                onChange={(e) =>
                  setEditing({ ...editing, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium">End Date</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1"
                value={editing.end_date}
                onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Method</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={editing.method}
                onChange={(e) => {
                  const m = e.target.value as "ALL" | "BEST_X";
                  setEditing({
                    ...editing,
                    method: m,
                    cap_x: m === "BEST_X" ? editing.cap_x ?? 20 : null,
                  });
                }}
              >
                <option value="ALL">ALL (no cap)</option>
                <option value="BEST_X">BEST X</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Cap (for BEST_X)</label>
              <input
                type="number"
                min={1}
                max={1000}
                className="w-full border rounded px-2 py-1"
                value={editing.cap_x ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    cap_x: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={editing.method !== "BEST_X"}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium">Notes</label>
              <textarea
                className="w-full border rounded px-2 py-1"
                rows={3}
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Any special rules (e.g., Season 7 starts 10/12/2024)"
              />
            </div>
          </div>

          {/* Prize bands */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Prize Bands</label>
                <button className="border rounded px-2 py-1 text-sm" onClick={addBand}>
                  + Add band
                </button>
              </div>

              {!editing.prize_bands?.length ? (
                <p className="text-sm text-neutral-500">No prize bands yet.</p>
              ) : (
                <div className="space-y-2">
                  {editing.prize_bands.map((b, idx) => (
                    <div key={idx} className="grid md:grid-cols-8 gap-2 items-end">
                      <div className="md:col-span-1">
                        <label className="block text-xs text-neutral-600">From</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border rounded px-2 py-1"
                          value={b.from}
                          onChange={(e) =>
                            updateBand(idx, { from: Number(e.target.value || 1) })
                          }
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs text-neutral-600">To</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border rounded px-2 py-1"
                          value={b.to}
                          onChange={(e) =>
                            updateBand(idx, { to: Number(e.target.value || b.from) })
                          }
                        />
                      </div>
                      <div className="md:col-span-5">
                        <label className="block text-xs text-neutral-600">Text</label>
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={b.text}
                          onChange={(e) => updateBand(idx, { text: e.target.value })}
                          placeholder="e.g., £250 credit"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <button
                          className="border rounded px-2 py-1 text-sm w-full"
                          onClick={() => removeBand(idx)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          <div className="flex items-center gap-2">
            <button className="border rounded px-3 py-1.5" onClick={save} disabled={loading}>
              Save
            </button>
            <button className="border rounded px-3 py-1.5" onClick={cancelEdit} disabled={loading}>
              Cancel
            </button>
            {editing.id ? (
              <>
                <button
                  className="border rounded px-3 py-1.5"
                  onClick={() => editing?.id && setActive(editing.id)}
                  disabled={loading || editing.is_active}
                  title={editing.is_active ? "Already active" : "Set as active season"}
                >
                  Set Active
                </button>
                <button
                  className="border rounded px-3 py-1.5"
                  onClick={() => editing?.id && remove(editing.id)}
                  disabled={loading}
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* List */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <b>Seasons</b>
          <button className="text-sm underline" onClick={fetchList} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="card-body p-0 overflow-x-auto">
          {loading && !list.length ? (
            <p className="p-4 text-sm text-neutral-600">Loading…</p>
          ) : !list.length ? (
            <p className="p-4 text-sm text-neutral-600">No seasons yet.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-left">Label</th>
                  <th className="text-left">Dates</th>
                  <th className="text-left">Method</th>
                  <th className="text-left">Cap</th>
                  <th className="text-left">Active</th>
                  <th className="text-left">Prizes</th>
                  <th className="text-left w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.label}</td>
                    <td>
                      {s.start_date} → {s.end_date}
                    </td>
                    <td>{s.method}</td>
                    <td>{s.method === "BEST_X" ? s.cap_x ?? "—" : "—"}</td>
                    <td>{s.is_active ? "✅" : "—"}</td>
                    <td>
                      {s.prize_bands?.length ? (
                        s.prize_bands.map((b, i) => (
                          <span
                            key={i}
                            className="inline-block mr-2 text-xs bg-neutral-100 dark:bg-neutral-900 rounded px-2 py-0.5"
                          >
                            {b.from === b.to ? b.from : `${b.from}-${b.to}`}: {b.text}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="border rounded px-2 py-1 text-sm"
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </button>
                        {!s.is_active && s.id ? (
                          <button
                            className="border rounded px-2 py-1 text-sm"
                            onClick={() => setActive(s.id!)}
                          >
                            Set Active
                          </button>
                        ) : null}
                        {s.id ? (
                          <button
                            className="border rounded px-2 py-1 text-sm"
                            onClick={() => remove(s.id!)}
                          >
                            Delete
                          </button>
                        ) : null}
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
