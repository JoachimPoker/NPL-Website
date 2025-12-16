// src/app/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";

type U = {
  id: string;
  email: string | null;
  app_metadata?: any;
  user_metadata?: any;
  created_at?: string;
  last_sign_in_at?: string | null;
};

export default function AdminUsersPage() {
  const [list, setList] = useState<U[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/users/list", { cache: "no-store" });
      const js = await res.json();
      if (!res.ok) throw new Error(js?._error || res.statusText);
      setList(js.users || []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setRoles(user_id: string, roles: string[]) {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/users/set-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id, roles }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js?._error || res.statusText);
      setOk("Updated roles.");
      void load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Local toolbar (top-level admin header comes from /admin/layout.tsx) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin — Users</h1>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => void load()}
          disabled={loading}
          type="button"
        >
          Refresh
        </button>
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

      <div className="card bg-base-100 shadow-sm overflow-x-auto">
        <div className="card-body p-0">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th className="text-left">Email</th>
                <th className="text-left">Roles</th>
                <th className="text-left">Last sign-in</th>
                <th className="text-left w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const roles: string[] = ((u.app_metadata?.roles) ?? []) as string[];
                const isAdmin = roles.includes("admin");
                return (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>
                      {roles.length ? (
                        <div className="flex flex-wrap gap-1">
                          {roles.map((r) => (
                            <span
                              key={r}
                              className="badge badge-ghost badge-xs"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{u.last_sign_in_at ?? "—"}</td>
                    <td className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-outline btn-xs"
                        type="button"
                        onClick={() =>
                          void setRoles(
                            u.id,
                            Array.from(new Set([...roles, "admin"]))
                          )
                        }
                        disabled={loading || isAdmin}
                        title={isAdmin ? "Already admin" : "Grant admin"}
                      >
                        Make admin
                      </button>
                      <button
                        className="btn btn-outline btn-xs btn-error"
                        type="button"
                        onClick={() =>
                          void setRoles(
                            u.id,
                            roles.filter((r) => r !== "admin")
                          )
                        }
                        disabled={loading || !isAdmin}
                        title={!isAdmin ? "Not an admin" : "Remove admin"}
                      >
                        Remove admin
                      </button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-4 text-sm text-base-content/70">
                    No users found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="py-4 text-sm text-base-content/70">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
