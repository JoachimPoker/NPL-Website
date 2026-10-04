"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ✅ Type definition matches your actual 'seasons' table
type Season = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at?: string;
};

type ListResp = { seasons: Season[]; _error?: string };

const emptySeason: Omit<Season, "id" | "created_at"> = {
  label: "",
  start_date: "",
  end_date: "",
  is_active: false,
};

export default function AdminSeasonsPage() {
  const [list, setList] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Season> | null>(null);
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
    setEditing({ ...s });
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
      // ✅ Only send fields that exist in the DB
      const body = {
        id: editing.id ?? null,
        label: (editing.label || "").trim(),
        start_date: editing.start_date,
        end_date: editing.end_date,
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-base-content/[0.07] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Seasons</h1>
          <p className="max-w-2xl text-sm text-base-content/60">
            Season dates follow the weekly reports. Open a season to set its leagues and scoring rules, or its prizes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={startCreate}
            disabled={!!editing}
          >
            + New season
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={fetchList}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="alert alert-error text-sm">
          <span>{err}</span>
        </div>
      )}
      {ok && (
        <div className="alert alert-success text-sm">
          <span>{ok}</span>
        </div>
      )}

      {/* Editor Form */}
      {editing && (
        <div className="panel">
          <div className="card-body space-y-4">
            <h3 className="font-display font-semibold text-lg">{editing.id ? "Edit season" : "New season"}</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">
                  <span className="label-text text-xs font-bold">Label</span>
                </label>
                <input
                  className="input input-bordered input-sm w-full"
                  value={editing.label || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, label: e.target.value })
                  }
                  placeholder="e.g. Season 2024"
                />
              </div>

              <div className="flex items-end justify-end pb-2">
                <label className="label cursor-pointer gap-2">
                  <span className="label-text text-sm">Active season</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={editing.is_active || false}
                    onChange={(e) =>
                      setEditing({ ...editing, is_active: e.target.checked })
                    }
                  />
                </label>
              </div>

              <div>
                <label className="label">
                  <span className="label-text text-xs font-bold">Start date</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={editing.start_date || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, start_date: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text text-xs font-bold">End date</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={editing.end_date || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, end_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={save}
                disabled={loading}
              >
                Save changes
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={cancelEdit}
                disabled={loading}
              >
                Cancel
              </button>
              
              {editing.id ? (
                <div className="ml-auto flex gap-2">
                   {!editing.is_active && (
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => editing.id && setActive(editing.id)}
                        disabled={loading}
                      >
                        Set active
                      </button>
                   )}
                   <button
                    className="btn btn-error btn-outline btn-sm"
                    type="button"
                    onClick={() => editing.id && remove(editing.id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* List Table */}
      <div className="panel overflow-hidden">
        <div className="card-body p-0 overflow-x-auto">
          {loading && !list.length ? (
            <p className="p-4 text-sm text-base-content/70">Loading…</p>
          ) : !list.length ? (
            <p className="p-4 text-sm text-base-content/70">No seasons found.</p>
          ) : (
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-base-200/50">
                  <th className="text-left">Label</th>
                  <th className="text-left">Dates</th>
                  <th className="text-center">Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="hover:bg-base-200/20">
                    <td className="font-medium text-base-content">{s.label}</td>
                    <td className="text-xs font-mono opacity-70">
                      {s.start_date} → {s.end_date}
                    </td>
                    <td className="text-center">
                      {s.is_active ? (
                        <span className="badge badge-success badge-xs">
                          Active
                        </span>
                      ) : (
                        <span className="opacity-20">—</span>
                      )}
                    </td>
                    <td className="text-right space-x-1">
                      <Link
                        href={`/admin/seasons/${s.id}`}
                        className="btn btn-ghost btn-xs"
                      >
                        Leagues
                      </Link>
                      <Link
                        href={`/admin/seasons/${s.id}/prizes`}
                        className="btn btn-ghost btn-xs"
                      >
                        Prizes
                      </Link>
                      <button
                        className="btn btn-ghost btn-xs"
                        type="button"
                        onClick={() => startEdit(s)}
                      >
                        Edit
                      </button>
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