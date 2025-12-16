"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Event = { id: string; name: string; start_date: string; is_high_roller: boolean };
type Festival = { id: string; label: string; series_id: number; start_date: string; end_date: string; city?: string };

export default function AdminFestivalManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();

  const [festival, setFestival] = useState<Festival | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [suggestions, setSuggestions] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ label: "", city: "", start_date: "", end_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    // 1. Get Festival Info
    const fRes = await fetch(`/api/admin/festivals/${id}`);
    const fData = await fRes.json();
    
    if (fData.festival) {
      const f = fData.festival;
      setFestival(f);
      setForm({ 
        label: f.label, 
        city: f.city || "", 
        start_date: f.start_date, 
        end_date: f.end_date 
      });

      // 2. Generate Search Params for Suggestions
      // Extract keywords (e.g. "GUKPT Coventry" -> "GUKPT,Coventry")
      const keywords = f.label
        .split(" ")
        .map((w: string) => w.replace(/[^a-zA-Z0-9]/g, "")) // Remove punctuation
        .filter((w: string) => w.length > 2) // Ignore "at", "in", "to"
        .join(",");

      // 3. Get Suggestions (Smart Filter)
      const params = new URLSearchParams();
      params.set("unassigned_only", "1");
      if (f.start_date) params.set("min_date", f.start_date);
      if (f.end_date) params.set("max_date", f.end_date);
      if (keywords) params.set("keywords", keywords);

      const sRes = await fetch(`/api/admin/events/list?${params.toString()}`);
      const sData = await sRes.json();
      if (sData.results) setSuggestions(sData.results);
    }

    // 4. Get Assigned Events
    const eRes = await fetch(`/api/admin/events/list?festival_id=${id}`);
    const eData = await eRes.json();
    if (eData.results) setEvents(eData.results);

    setLoading(false);
  }

  async function updateFestival() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/festivals/update", {
        method: "POST",
        body: JSON.stringify({ id, ...form })
      });
      if (!res.ok) throw new Error("Update failed");
      setEditOpen(false);
      loadData(); // Reload to refresh suggestions based on new dates/name
    } catch (e) {
      alert("Failed to update festival");
    } finally {
      setSaving(false);
    }
  }

  async function assignEvent(eventId: string) {
    await fetch("/api/admin/festivals/assign-event", {
      method: "POST",
      body: JSON.stringify({ event_ids: [eventId], festival_id: id })
    });
    loadData();
  }

  async function removeEvent(eventId: string) {
    await fetch("/api/admin/festivals/assign-event", {
      method: "POST",
      body: JSON.stringify({ event_ids: [eventId], festival_id: null }) 
    });
    loadData();
  }

  if (!festival && !loading) return <div className="p-12 text-center">Festival not found</div>;

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-secondary mb-1">Festival Manager</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">{festival?.label}</h1>
          <p className="text-base-content/60 font-mono mt-1">{festival?.start_date} → {festival?.end_date}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setEditOpen(true)} className="btn btn-outline btn-sm uppercase font-bold">Edit Details</button>
            <button onClick={() => router.back()} className="btn btn-ghost btn-sm uppercase font-bold">← Back</button>
        </div>
      </div>

      {/* Events List */}
      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* LEFT: Assigned Events */}
        <div className="card bg-base-100 shadow-xl border border-white/5">
          <div className="card-header p-4 border-b border-white/5 bg-base-200/20 flex justify-between items-center">
            <h3 className="font-bold uppercase tracking-wide">Included Events</h3>
            <span className="badge badge-sm">{events.length}</span>
          </div>
          <div className="p-0 overflow-y-auto max-h-[600px]">
            <table className="table w-full">
              <tbody>
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-base-200/30 border-b border-white/5">
                    <td className="font-mono text-xs opacity-50 w-24">{e.start_date}</td>
                    <td className="font-bold text-sm">{e.name}</td>
                    <td className="text-right">
                      <button className="btn btn-xs btn-ghost text-error" onClick={() => removeEvent(e.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
                {!events.length && (
                   <tr><td colSpan={3} className="p-8 text-center text-sm opacity-50">No events in this festival yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Suggestions (Smart Filter) */}
        <div className="card bg-base-100 shadow-xl border border-white/5">
           <div className="card-header p-4 border-b border-white/5 bg-base-200/20">
             <h3 className="font-bold uppercase tracking-wide text-success">Suggested Events</h3>
             <p className="text-xs opacity-50">Matching date range & keywords</p>
           </div>
           <div className="p-0 overflow-y-auto max-h-[600px]">
             <table className="table table-xs w-full">
               <tbody>
                 {suggestions.map(u => (
                   <tr key={u.id} className="hover:bg-base-200/30 border-b border-white/5">
                     <td>
                       <div className="font-bold truncate max-w-[200px]" title={u.name}>{u.name}</div>
                       <div className="text-xs opacity-50">{u.start_date}</div>
                     </td>
                     <td className="text-right">
                       <button className="btn btn-xs btn-ghost text-success" onClick={() => assignEvent(u.id)}>+</button>
                     </td>
                   </tr>
                 ))}
                 {!suggestions.length && (
                    <tr><td colSpan={2} className="p-8 text-center text-sm opacity-50">No matching unassigned events found.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditOpen(false)} />
          <div className="relative w-full max-w-lg bg-base-100 rounded-xl shadow-2xl p-6 space-y-4 border border-white/10">
            <h3 className="text-lg font-bold uppercase text-white">Edit Festival</h3>
            
            <div className="form-control">
                <label className="label text-xs uppercase font-bold opacity-50">Name</label>
                <input className="input input-bordered w-full" value={form.label} onChange={e => setForm({...form, label: e.target.value})} />
            </div>
            
            <div className="form-control">
                <label className="label text-xs uppercase font-bold opacity-50">City</label>
                <input className="input input-bordered w-full" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label text-xs uppercase font-bold opacity-50">Start Date</label>
                <input type="date" className="input input-bordered" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
              <div className="form-control">
                <label className="label text-xs uppercase font-bold opacity-50">End Date</label>
                <input type="date" className="input input-bordered" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={updateFestival} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}