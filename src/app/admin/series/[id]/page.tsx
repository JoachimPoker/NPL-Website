"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

/* --- Types --- */
type Series = { id: number; name: string; slug?: string | null; description?: string | null; };
type Festival = { id: string; series_id: number | null; label: string; city: string | null; start_date: string; end_date: string; };
type ResultRow = { id: string; tournament_name: string | null; start_date: string | null; series_id: number | null; series_slug?: string | null; festival_id: string | null; };
type SeriesGetResp = { ok?: boolean; series?: Series; _error?: string };

/* --- Reusable Modal --- */
function Modal({ open, title, onClose, children }: { open: boolean; title?: string; onClose: () => void; children: React.ReactNode; }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-xl bg-base-100 shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-bold uppercase tracking-wide">{title || "Modal"}</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function AdminSeriesManagePage() {
  const params = useParams() as { id?: string };
  const searchParams = useSearchParams();
  const seriesId = Number(params?.id ?? 0);

  // --- STATE ---
  const [series, setSeries] = useState<Series | null>(null);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);

  // Filters
  const [q, setQ] = useState<string>(searchParams.get("q") ?? "");
  const [page, setPage] = useState<number>(Number(searchParams.get("page") || 1) || 1);
  const [pageSize, setPageSize] = useState<number>(100);

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  // Festival Modal State
  const [festModalOpen, setFestModalOpen] = useState(false);
  const [festMode, setFestMode] = useState<"create" | "edit">("create");
  const [editingFestId, setEditingFestId] = useState<string | null>(null);
  const [festForm, setFestForm] = useState({ label: "", city: "", start_date: "", end_date: "" });

  // Series Edit State
  const [editingSeries, setEditingSeries] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });

  /* --- DATA LOADING --- */
  async function loadAllData() {
    if (!seriesId) return;
    setLoading(true);
    await Promise.all([ loadSeriesDetails(), loadSeriesOptions(), loadFestivals() ]);
    await loadResults();
    setLoading(false);
  }

  useEffect(() => { loadAllData(); }, [seriesId]);

  async function loadSeriesDetails() {
    try {
      const r = await fetch(`/api/admin/series/get?id=${seriesId}`);
      const js: SeriesGetResp = await r.json();
      if (js?.series) {
        setSeries(js.series);
        setForm({ name: js.series.name, slug: js.series.slug || "", description: js.series.description || "" });
      }
    } catch (e: any) { setErr(e.message); }
  }

  async function loadSeriesOptions() {
    try {
        const r = await fetch("/api/admin/series/list");
        const js = await r.json();
        if(js.series) setAllSeries(js.series);
    } catch (e) {}
  }

  async function loadFestivals() {
    const r = await fetch(`/api/admin/festivals/list?series_id=${seriesId}`);
    const js = await r.json();
    setFestivals(js.festivals || []);
  }

  async function loadResults() {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
    if (q) params.set("q", q);
    const r = await fetch(`/api/admin/series/${seriesId}/events?` + params.toString());
    const js = await r.json();
    setResults(js.results || []);
    setTotal(js.total || 0);
  }

  /* --- ACTIONS --- */
  async function saveSeries() {
    setLoading(true);
    await fetch("/api/admin/series/update", {
        method: "POST",
        body: JSON.stringify({ id: seriesId, ...form })
    });
    setEditingSeries(false);
    await loadSeriesDetails();
    setLoading(false);
  }

  async function saveFestival() {
    const payload = { series_id: seriesId, ...festForm };
    const url = festMode === "create" ? "/api/admin/festivals/create" : "/api/admin/festivals/update";
    const body = festMode === "edit" ? { id: editingFestId, ...payload } : payload;
    
    await fetch(url, { method: "POST", body: JSON.stringify(body) });
    setFestModalOpen(false);
    loadFestivals();
  }

  async function setSeriesFor(ids: string[], op: "assign" | "clear") {
    if (!seriesId || !ids.length) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/series/${seriesId}/events`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_ids: ids, op }),
      });
      await loadResults();
      setSelected({});
    } catch (e) { alert("Failed to update events"); } 
    finally { setLoading(false); }
  }

  async function assignFestivalTo(ids: string[], festival_id: string | null) {
    if (!ids.length) return;
    setLoading(true);
    try {
      await fetch("/api/admin/festivals/assign-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_ids: ids, festival_id }),
      });
      await loadResults();
      setSelected({});
    } catch (e) { alert("Failed to update festival"); }
    finally { setLoading(false); }
  }

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    results.forEach(r => next[r.id] = checked);
    setSelected(next);
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 space-y-8">
      
      {/* HEADER & KPI */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Series Manager</div>
                <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
                    {series?.name || "Loading..."}
                </h1>
            </div>
            <div className="flex gap-2">
                <Link href="/admin/series" className="btn btn-ghost btn-sm">← Back</Link>
                <button onClick={() => window.open(`/series/${series?.slug}`, '_blank')} className="btn btn-outline btn-sm">View Public Page ↗</button>
            </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat bg-base-100 shadow-xl border border-white/5 rounded-xl">
                <div className="stat-title text-xs font-bold uppercase opacity-60">Total Events</div>
                <div className="stat-value text-primary">{total}</div>
            </div>
            <div className="stat bg-base-100 shadow-xl border border-white/5 rounded-xl">
                <div className="stat-title text-xs font-bold uppercase opacity-60">Festivals</div>
                <div className="stat-value text-secondary">{festivals.length}</div>
            </div>
            <div className="stat bg-base-100 shadow-xl border border-white/5 rounded-xl">
                <div className="stat-title text-xs font-bold uppercase opacity-60">Status</div>
                <div className="stat-value text-white text-2xl">Active</div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Details & Festivals */}
        <div className="space-y-8">
            
            {/* 1. DETAILS */}
            <div className="card bg-base-100 shadow-xl border border-white/5">
                <div className="card-body p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="card-title text-sm uppercase tracking-widest">Details</h3>
                        {!editingSeries && <button className="btn btn-xs btn-ghost" onClick={() => setEditingSeries(true)}>Edit</button>}
                    </div>
                    
                    {editingSeries ? (
                        <div className="space-y-3">
                            <input className="input input-sm input-bordered w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" />
                            <input className="input input-sm input-bordered w-full font-mono" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="slug" />
                            <textarea className="textarea textarea-sm textarea-bordered w-full" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description" />
                            <div className="flex justify-end gap-2">
                                <button className="btn btn-xs btn-ghost" onClick={() => setEditingSeries(false)}>Cancel</button>
                                <button className="btn btn-xs btn-primary" onClick={saveSeries}>Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <div className="opacity-50 text-[10px] uppercase font-bold">Name</div>
                                <div className="font-bold">{series?.name}</div>
                            </div>
                            <div>
                                <div className="opacity-50 text-[10px] uppercase font-bold">Slug</div>
                                <div className="font-mono text-xs bg-base-200 px-2 py-1 rounded inline-block">{series?.slug || "—"}</div>
                            </div>
                            <div>
                                <div className="opacity-50 text-[10px] uppercase font-bold">About</div>
                                <p className="text-sm opacity-70">{series?.description || "No description."}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. FESTIVALS */}
            <div className="card bg-base-100 shadow-xl border border-white/5">
                <div className="card-body p-0">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-base-200/30">
                        <h3 className="font-bold text-sm uppercase tracking-widest">Festivals</h3>
                        <button className="btn btn-xs btn-primary" onClick={() => { setFestMode('create'); setFestForm({ label: "", city: "", start_date: "", end_date: "" }); setFestModalOpen(true); }}>+ Add</button>
                    </div>
                    <table className="table w-full">
                        <tbody className="text-xs">
                            {festivals.length === 0 ? (
                                <tr><td className="text-center py-6 opacity-50">No festivals yet.</td></tr>
                            ) : festivals.map(f => (
                                <tr key={f.id} className="hover:bg-base-200/20 border-b border-white/5 last:border-0">
                                    <td>
                                        <div className="font-bold">{f.label}</div>
                                        <div className="opacity-50 text-[10px]">{f.start_date} → {f.end_date}</div>
                                    </td>
                                    <td className="text-right">
                                        <button className="btn btn-xs btn-ghost" onClick={() => { setFestMode('edit'); setEditingFestId(f.id); setFestForm(f as any); setFestModalOpen(true); }}>Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        {/* RIGHT COLUMN: Events Table */}
        <div className="lg:col-span-2 space-y-4">
            
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div className="form-control w-full">
                    <input className="input input-bordered input-sm w-full" placeholder="Search events in this series..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadResults()} />
                </div>
                
                {/* BULK ACTIONS */}
                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2 bg-base-200 px-3 py-1 rounded-lg shrink-0">
                        <span className="text-xs font-bold">{selectedIds.length} Selected</span>
                        <div className="h-4 w-px bg-base-content/20"></div>
                        <select 
                            className="select select-bordered select-xs" 
                            onChange={(e) => {
                                if(e.target.value === 'remove') setSeriesFor(selectedIds, 'clear');
                                else if(e.target.value) assignFestivalTo(selectedIds, e.target.value);
                                e.target.value = '';
                            }}
                        >
                            <option value="">-- Actions --</option>
                            <option value="remove">Remove from Series</option>
                            <optgroup label="Assign to Festival">
                                {festivals.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </optgroup>
                        </select>
                    </div>
                )}
            </div>

            <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                        <thead className="bg-base-200/50 text-xs uppercase font-bold">
                            <tr>
                                <th className="w-10"><input type="checkbox" className="checkbox checkbox-xs" onChange={e => toggleAll(e.target.checked)} /></th>
                                <th>Date</th>
                                <th>Tournament</th>
                                <th>Festival</th>
                                <th className="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(r => (
                                <tr key={r.id} className="hover:bg-base-200/20 border-b border-white/5 last:border-0">
                                    <td><input type="checkbox" className="checkbox checkbox-xs" checked={!!selected[r.id]} onChange={e => setSelected({...selected, [r.id]: e.target.checked})} /></td>
                                    <td className="font-mono text-xs opacity-70 whitespace-nowrap">{r.start_date}</td>
                                    <td className="font-bold text-sm">
                                        {r.tournament_name || <span className="opacity-30 italic">Unnamed Event</span>}
                                    </td>
                                    <td><span className="badge badge-ghost badge-xs">{festivals.find(f => f.id === r.festival_id)?.label || "—"}</span></td>
                                    <td className="text-right">
                                        {r.series_id !== seriesId ? (
                                            <button className="btn btn-xs btn-outline" onClick={() => setSeriesFor([r.id], 'assign')}>+ Add</button>
                                        ) : (
                                            <button className="btn btn-xs btn-ghost text-error" onClick={() => setSeriesFor([r.id], 'clear')}>Remove</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                <div className="p-4 border-t border-white/5 flex justify-center gap-2 bg-base-200/30">
                    <button className="btn btn-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>« Prev</button>
                    <span className="text-xs self-center opacity-50">Page {page}</span>
                    <button className="btn btn-xs" disabled={results.length < pageSize} onClick={() => setPage(p => p + 1)}>Next »</button>
                </div>
            </div>
        </div>

      </div>

      {/* --- MODAL (Festival) --- */}
      <Modal open={festModalOpen} title={`${festMode === 'edit' ? 'Edit' : 'Create'} Festival`} onClose={() => setFestModalOpen(false)}>
        <div className="space-y-4">
            <div className="form-control">
                <label className="label text-xs font-bold uppercase">Label</label>
                <input className="input input-bordered w-full" placeholder="e.g. UKPL Liverpool" value={festForm.label} onChange={e => setFestForm({...festForm, label: e.target.value})} />
            </div>
            <div className="form-control">
                <label className="label text-xs font-bold uppercase">City</label>
                <input className="input input-bordered w-full" value={festForm.city} onChange={e => setFestForm({...festForm, city: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                    <label className="label text-xs font-bold uppercase">Start Date</label>
                    <input type="date" className="input input-bordered w-full" value={festForm.start_date} onChange={e => setFestForm({...festForm, start_date: e.target.value})} />
                </div>
                <div className="form-control">
                    <label className="label text-xs font-bold uppercase">End Date</label>
                    <input type="date" className="input input-bordered w-full" value={festForm.end_date} onChange={e => setFestForm({...festForm, end_date: e.target.value})} />
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button className="btn btn-ghost" onClick={() => setFestModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveFestival} disabled={loading}>{festMode === 'edit' ? 'Save Changes' : 'Create Festival'}</button>
            </div>
        </div>
      </Modal>

    </div>
  );
}