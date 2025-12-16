"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Series = { id: number; name: string; slug?: string; description?: string };
type Festival = { id: string; label: string; start_date: string; end_date: string; event_count?: number };

export default function AdminSeriesManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const seriesId = Number(id);
  const router = useRouter();

  const [series, setSeries] = useState<Series | null>(null);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [festForm, setFestForm] = useState({ label: "", start_date: "", end_date: "" });

  useEffect(() => {
    loadData();
  }, [seriesId]);

  async function loadData() {
    setLoading(true);
    // 1. Get Series
    const sRes = await fetch(`/api/admin/series/get?id=${seriesId}`);
    const sData = await sRes.json();
    if (sData.series) setSeries(sData.series);

    // 2. Get Festivals
    const fRes = await fetch(`/api/admin/festivals/list?series_id=${seriesId}`);
    const fData = await fRes.json();
    if (fData.festivals) setFestivals(fData.festivals);
    
    setLoading(false);
  }

  async function createFestival() {
    await fetch("/api/admin/festivals/create", {
      method: "POST",
      body: JSON.stringify({ ...festForm, series_id: seriesId })
    });
    setModalOpen(false);
    setFestForm({ label: "", start_date: "", end_date: "" });
    loadData();
  }

  if (!series && !loading) return <div className="p-12 text-center">Series not found</div>;

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Series Manager</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">{series?.name}</h1>
        </div>
        <Link href="/admin/series" className="btn btn-ghost btn-sm uppercase font-bold">← Back</Link>
      </div>

      {/* Festivals List */}
      <div className="card bg-base-100 shadow-xl border border-white/5">
        <div className="card-header p-6 border-b border-white/5 flex justify-between items-center bg-base-200/20">
          <h3 className="text-xl font-bold uppercase tracking-wide">Festivals</h3>
          <button className="btn btn-sm btn-primary uppercase font-bold" onClick={() => setModalOpen(true)}>+ Add Festival</button>
        </div>
        
        <div className="p-0">
           {!festivals.length ? (
             <div className="p-12 text-center text-base-content/50 italic">
               No festivals in this series yet. Add one to start adding events.
             </div>
           ) : (
             <table className="table table-lg w-full">
               <thead>
                 <tr className="bg-base-200/50 text-xs uppercase text-base-content/60">
                   <th>Dates</th>
                   <th>Festival Name</th>
                   <th className="text-right">Action</th>
                 </tr>
               </thead>
               <tbody>
                 {festivals.map(f => (
                   <tr key={f.id} className="hover:bg-base-200/30 border-b border-white/5 last:border-0 cursor-pointer" onClick={() => router.push(`/admin/festivals/${f.id}`)}>
                     <td className="font-mono text-sm opacity-60 w-48">
                       {f.start_date} → {f.end_date}
                     </td>
                     <td>
                       <div className="font-bold text-lg text-white">{f.label}</div>
                       <div className="text-xs text-primary mt-1">Click to manage events</div>
                     </td>
                     <td className="text-right">
                       <Link href={`/admin/festivals/${f.id}`} className="btn btn-sm btn-outline uppercase font-bold">
                         Manage
                       </Link>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-base-100 rounded-xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold uppercase">Add Festival</h3>
            <input className="input input-bordered w-full" placeholder="Festival Name (e.g. GUKPT London)" value={festForm.label} onChange={e => setFestForm({...festForm, label: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <input type="date" className="input input-bordered" value={festForm.start_date} onChange={e => setFestForm({...festForm, start_date: e.target.value})} />
              <input type="date" className="input input-bordered" value={festForm.end_date} onChange={e => setFestForm({...festForm, end_date: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createFestival}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}