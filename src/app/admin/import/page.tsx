"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { History, Layers, UploadCloud, Calendar } from "lucide-react";

// Import the Updated Bulk Uploader
import BulkUploader from "@/components/admin/BulkUploader";

// --- TYPES ---
type Batch = {
  id: string;
  created_at: string;
  snapshot_date?: string;
  filename: string;
  row_count: number;
  uploaded_by: string;
};

type EventRow = {
  id: string;
  name: string;
  start_date: string;
  site_name: string;
  is_high_roller: boolean;
  series_id: string | null;
};

type Series = { id: string; label: string };

// --- MAIN PAGE ---
export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // --- SHARED STATE ---
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [history, setHistory] = useState<Batch[]>([]);

  // --- SINGLE UPLOAD STATE ---
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); 
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseClient();

  // Load History on Mount
  useEffect(() => {
    fetchHistory();
  }, [reviewBatchId]); // Refresh history whenever a review is finished

  async function fetchHistory() {
    const { data } = await supabase
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data as any);
  }

  // --- SINGLE UPLOAD HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    if (date) formData.append("snapshotDate", date);

    try {
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      
      // Success!
      if (json.batch_id) {
        setReviewBatchId(json.batch_id); // Trigger the modal
      } else {
        alert("Upload complete.");
      }
      
      setFile(null); 
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Admin Tools</div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Import Center</h1>
        </div>
        <Link href="/admin" className="btn btn-ghost btn-sm">← Dashboard</Link>
      </div>

      {/* TABS */}
      <div role="tablist" className="tabs tabs-boxed bg-base-100 p-2 w-fit">
        <a 
            role="tab" 
            className={`tab gap-2 ${activeTab === 'single' ? 'tab-active font-bold !bg-primary !text-black' : ''}`}
            onClick={() => setActiveTab('single')}
        >
            <UploadCloud className="w-4 h-4" />
            Weekly Upload
        </a>
        <a 
            role="tab" 
            className={`tab gap-2 ${activeTab === 'bulk' ? 'tab-active font-bold !bg-secondary !text-black' : ''}`}
            onClick={() => setActiveTab('bulk')}
        >
            <Layers className="w-4 h-4" />
            Bulk Historical
        </a>
      </div>

      {/* --- CONTENT AREA --- */}

      {activeTab === 'single' ? (
        /* MODE A: SINGLE UPLOAD + HISTORY */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
            {/* LEFT: UPLOAD FORM */}
            <div className="space-y-6">
                <div className="card bg-base-100 shadow-2xl border border-white/5">
                    <div className="card-body p-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold uppercase tracking-wide">Single File Upload</h3>
                            <span className="badge badge-primary badge-outline text-xs">For Weekly Results</span>
                        </div>

                        <form onSubmit={handleSingleSubmit} className="space-y-6">
                            
                            {/* Date Picker */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-bold uppercase text-xs tracking-wider opacity-70 flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> Event Date
                                    </span>
                                </label>
                                <input 
                                    type="date" 
                                    className="input input-bordered bg-base-200/50 w-full font-mono text-sm focus:input-primary"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                                <div className="text-[10px] text-base-content/40 mt-1.5 ml-1">
                                    Used for ranking history graphs.
                                </div>
                            </div>

                            {/* Drop Zone */}
                            <div 
                                className={`
                                    relative w-full h-40 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2
                                    ${dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-white/10 bg-base-200/20 hover:border-primary/50 hover:bg-base-200/40"}
                                    ${file ? "border-success/50 bg-success/5" : ""}
                                `}
                                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
                                {file ? (
                                    <div className="text-center animate-pulse">
                                        <FileSpreadsheet className="w-8 h-8 mx-auto text-success mb-2" />
                                        <p className="text-sm font-bold text-success">{file.name}</p>
                                    </div>
                                ) : (
                                    <div className="text-center opacity-50">
                                        <UploadCloud className="w-8 h-8 mx-auto mb-2" />
                                        <p className="text-sm font-bold">Drag & Drop Excel</p>
                                        <p className="text-xs mt-1">or click to browse</p>
                                    </div>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                disabled={!file || uploading || !date}
                                className="btn btn-primary btn-block uppercase font-bold tracking-widest shadow-lg shadow-primary/20"
                            >
                                {uploading ? <span className="loading loading-spinner"></span> : "Process Weekly File"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* RIGHT: IMPORT HISTORY */}
            <div className="space-y-6">
                <h3 className="text-lg font-bold uppercase tracking-wide px-1 flex items-center gap-2">
                    <History className="w-4 h-4 opacity-70" /> Recent Uploads
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/5 bg-base-100 shadow-xl">
                    <table className="table table-sm w-full">
                        <thead className="bg-base-200/50 text-[10px] uppercase text-base-content/50">
                            <tr>
                                <th className="py-3 pl-4">Snapshot Date</th>
                                <th className="py-3">File</th>
                                <th className="py-3 text-right pr-4">Rows</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={3} className="text-center py-8 opacity-40 text-xs italic">No history found.</td></tr>
                            ) : (
                                history.map((h) => (
                                    <tr key={h.id} className="border-b border-white/5 last:border-0 hover:bg-base-200/30 transition-colors">
                                        <td className="pl-4 font-mono text-xs opacity-60">
                                            {h.snapshot_date 
                                                ? new Date(h.snapshot_date).toLocaleDateString()
                                                : new Date(h.created_at).toLocaleDateString()
                                            }
                                        </td>
                                        <td className="font-medium text-xs truncate max-w-[150px]" title={h.filename}>
                                            {h.filename}
                                        </td>
                                        <td className="pr-4 text-right font-mono text-xs text-primary">
                                            {h.row_count}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      ) : (
        /* MODE B: BULK UPLOADER */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-4xl mx-auto">
                 <div className="alert alert-info shadow-sm mb-8 border-info/20 bg-info/10 text-xs">
                    <Layers className="w-4 h-4" />
                    <span>
                        <strong>Sequential Mode:</strong> Files are processed one by one. The Event Review modal will open for each file.
                    </span>
                 </div>
                 
                 {/* HERE IS THE INTEGRATION:
                    We pass the function that triggers the review modal
                 */}
                 <BulkUploader 
                    onUploadComplete={(batchId) => setReviewBatchId(batchId)} 
                 />
            </div>
        </div>
      )}

      {/* --- REVIEW MODAL --- */}
      {reviewBatchId && (
        <ImportReviewModal 
          batchId={reviewBatchId} 
          onClose={() => setReviewBatchId(null)} 
        />
      )}

    </div>
  );
}

// --- SUB-COMPONENT: REVIEW MODAL (Unchanged) ---
function ImportReviewModal({ batchId, onClose }: { batchId: string, onClose: () => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createSupabaseClient();
        const resEvents = await fetch(`/api/admin/import-batches/${batchId}/events`);
        if (!resEvents.ok) throw new Error("Failed to load events.");
        const eventsData = await resEvents.json();
        
        const { data: seriesData } = await supabase.from("series").select("id, name").order("name");
        
        setEvents(eventsData || []);
        setSeriesList((seriesData || []).map((s: any) => ({ id: s.id, label: s.name })));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [batchId]);

  const toggleHighRoller = (id: string, current: boolean) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_high_roller: !current } : e));
  };

  const changeSeries = (id: string, seriesId: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, series_id: seriesId === "none" ? null : seriesId } : e));
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/events/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          updates: events.map(e => ({ 
            id: e.id, 
            is_high_roller: e.is_high_roller, 
            series_id: e.series_id 
          })) 
        })
      });
      if (!res.ok) throw new Error("Failed to save changes");
      
      // Close modal - this triggers the parent page to resume flow
      onClose(); 
    } catch (e) {
      alert("Error saving updates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-base-100 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-white/10">
        
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-base-200/50 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wide">🚀 Import Successful</h3>
            <p className="text-xs text-base-content/60">We found {events.length} events. Review them below.</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
             <div className="p-12 text-center"><span className="loading loading-spinner loading-lg"></span></div>
          ) : error ? (
             <div className="p-12 text-center text-error font-bold">❌ {error}</div>
          ) : events.length === 0 ? (
             <div className="p-12 text-center text-base-content/50 italic">No new events found to review.</div>
          ) : (
            <table className="table w-full">
              <thead className="bg-base-200/50 sticky top-0 z-10 text-xs font-bold uppercase">
                <tr>
                  <th className="pl-6">Event Name</th>
                  <th>Series</th>
                  <th className="text-center">High Roller?</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-base-200/20">
                    <td className="pl-6 py-4">
                      <div className="font-bold text-sm">{e.name}</div>
                      <div className="text-xs opacity-50">{new Date(e.start_date).toLocaleDateString()} • {e.site_name}</div>
                    </td>
                    <td>
                      <select 
                        className="select select-bordered select-sm w-full max-w-xs text-xs"
                        value={e.series_id || "none"}
                        onChange={(ev) => changeSeries(e.id, ev.target.value)}
                      >
                        <option value="none">-- No Series --</option>
                        {seriesList.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={e.is_high_roller}
                        onChange={() => toggleHighRoller(e.id, e.is_high_roller)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-base-200/30 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost">Skip Review</button>
          <button 
            onClick={saveChanges} 
            disabled={loading || saving || !!error}
            className="btn btn-primary px-8 uppercase font-bold tracking-widest"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

      </div>
    </div>
  );
}