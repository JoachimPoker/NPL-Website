"use client";

import { useState } from "react";
import readXlsxFile from "read-excel-file";
import { Upload, Loader2, FileSpreadsheet, Trash2, Calendar, CheckCircle2, AlertCircle, Play, ArrowRight } from "lucide-react";

// --- TYPES ---
type QueuedFile = {
  id: string; 
  file: File;
  rows: any[];
  date: string; 
  status: "pending" | "done" | "error";
  errorMsg?: string;
};

// --- HELPER: Week to Date ---
function getDateFromWeek(year: number, week: number): string {
  try {
    const d = new Date(Date.UTC(year, 0, 4));
    d.setUTCDate(d.getUTCDate() + 7 * (week - 1));
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    d.setUTCDate(diff);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return "";
  }
}

// We add a callback prop so we can tell the parent page to open the Review Modal
export default function BulkUploader({ onUploadComplete }: { onUploadComplete: (batchId: string) => void }) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isReading, setIsReading] = useState(false);
  
  // SEQUENTIAL PROCESSING STATE
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. READ FILES LOCALLY
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setIsReading(true);
    const files = Array.from(e.target.files);
    const newQueueItems: QueuedFile[] = [];

    for (const file of files) {
      const fileId = Math.random().toString(36).substring(7);
      let defaultDate = "";
      let rows: any[] = [];
      let status: "pending" | "error" = "pending";
      let errorMsg = "";

      // Auto-guess date
      const weekMatch = file.name.match(/Week(\d{2})/i);
      const yearMatch = file.name.match(/20\d{2}/);
      if (weekMatch && yearMatch) {
         defaultDate = getDateFromWeek(parseInt(yearMatch[0]), parseInt(weekMatch[1]));
      }

      try {
        const rawData = await readXlsxFile(file);
        if (rawData.length < 2) throw new Error("File is empty");

        // Parse Headers
        const headerRow = rawData[0] as string[];
        const colMap = { id: -1, name: -1, points: -1, rank: -1, events: -1, wins: -1 };

        headerRow.forEach((cell, index) => {
            if (!cell) return;
            const val = String(cell).toLowerCase().trim();
            if (val === "id" || val.includes("player_id") || val.includes("player id") || val.includes("member")) colMap.id = index;
            if (val.includes("player") && !val.includes("id")) colMap.name = index; 
            if (val.includes("point") || val.includes("total")) colMap.points = index;
            if (val.includes("rank") || val.includes("pos") || val === "#") colMap.rank = index;
            if (val.includes("event") || val.includes("played")) colMap.events = index;
            if (val.includes("wins")) colMap.wins = index;
        });

        if (colMap.points === -1) throw new Error("Missing 'Points' column");

        rows = rawData.slice(1).map((row: any) => {
            const rawId = colMap.id > -1 ? row[colMap.id] : null;
            const name = colMap.name > -1 ? row[colMap.name] : "Unknown";
            const points = row[colMap.points];
            if (!points) return null;

            return {
                player_id: rawId ? String(rawId).trim() : null,
                name: String(name).trim(),
                points: Number(points) || 0,
                rank: colMap.rank > -1 ? (Number(row[colMap.rank]) || 0) : 0,
                events: colMap.events > -1 ? (Number(row[colMap.events]) || 0) : 0,
                wins: colMap.wins > -1 ? (Number(row[colMap.wins]) || 0) : 0,
            };
        }).filter(Boolean);

      } catch (err: any) {
        status = "error";
        errorMsg = err.message.includes("password") ? "❌ Password Protected" : err.message;
      }

      newQueueItems.push({ id: fileId, file, rows, date: defaultDate, status, errorMsg });
    }

    setQueue(prev => [...prev, ...newQueueItems]);
    setIsReading(false);
  };

  const removeFile = (id: string) => setQueue(prev => prev.filter(q => q.id !== id));
  const updateDate = (id: string, newDate: string) => setQueue(prev => prev.map(q => q.id === id ? { ...q, date: newDate } : q));

  // 2. START THE SEQUENCE
  const startSequence = () => {
    // Find the first pending file
    const firstPending = queue.findIndex(q => q.status === "pending" && q.date);
    if (firstPending === -1) {
        alert("No ready files found. Check dates.");
        return;
    }
    setProcessingIndex(firstPending);
    uploadOneFile(firstPending);
  };

  // 3. UPLOAD SINGLE FILE
  const uploadOneFile = async (index: number) => {
    const item = queue[index];
    if (!item || !item.date) return;

    setIsUploading(true);

    try {
        // Send as a "single file batch" to the same API
        const payload = [{
            filename: item.file.name,
            date: item.date,
            rows: item.rows
        }];

        const res = await fetch("/api/admin/bulk-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshots: payload, league: "npl" }), 
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error);

        // Mark as done
        setQueue(prev => prev.map((q, i) => i === index ? { ...q, status: "done" } : q));
        
        // TRIGGER PARENT TO OPEN MODAL
        // The parent (Page) will receive this ID, open the modal, and wait for user to click "Save"
        if (onUploadComplete) {
            // We pass a special "next" function via a global or just rely on the parent updating
            // Actually, we pause here. The Effect in the parent handles the modal.
            // We just need a way to resume.
            onUploadComplete(json.batch_id || "done"); 
        }

    } catch (e: any) {
        setQueue(prev => prev.map((q, i) => i === index ? { ...q, status: "error", errorMsg: e.message } : q));
        alert(`Error uploading ${item.file.name}: ${e.message}`);
    } finally {
        setIsUploading(false);
    }
  };

  // 4. RESUME (Called by Parent when Modal closes)
  // We expose this so the parent page can call it
  const processNext = () => {
    if (processingIndex === null) return;
    
    const nextIndex = processingIndex + 1;
    if (nextIndex < queue.length) {
        setProcessingIndex(nextIndex);
        // Only auto-process if the next one is valid
        if (queue[nextIndex].status === "pending" && queue[nextIndex].date) {
             uploadOneFile(nextIndex);
        } else {
             // If next file has error/no date, we stop or skip? Let's stop.
             alert(`Stopping at ${queue[nextIndex].file.name}. Please fix date/error and click Start again.`);
             setProcessingIndex(null);
        }
    } else {
        setProcessingIndex(null);
        alert("🎉 All files processed!");
    }
  };

  // Expose processNext to window/parent purely for this example or pass via prop ref
  // Ideally we lift state up, but for now we can attach it to the component instance 
  // or just let the user click "Process Next" manually if we want to be safe.
  
  // BETTER UX: Just show a "Continue" button or auto-trigger if we lift state.
  // For simplicity: Let's make the USER click "Next File" in the UI if we don't refactor the whole page.
  // OR: We can store the `processNext` function in a hidden button the parent can click? 
  // No, let's keep it simple: The Review Modal "Save" button will update the Page, 
  // and the Page will pass a prop back down? Too complex.
  
  // SIMPLEST:
  // 1. Upload finishes.
  // 2. We call onUploadComplete.
  // 3. Parent opens Modal.
  // 4. Modal closes. Parent does nothing specific.
  // 5. User sees "File 1 Done".
  // 6. User clicks "Continue to Next" button in this component?
  
  // Let's implement auto-advance by listening to a prop `triggerNext`?
  
  return (
    <div className="card bg-base-100 shadow-xl border border-white/10">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2 text-primary">
            <FileSpreadsheet className="w-6 h-6" />
            Sequential Bulk Import
        </h2>
        
        {/* FILE INPUT */}
        <div className="form-control w-full mt-4">
            <label className={`btn btn-outline border-dashed h-24 flex flex-col items-center justify-center gap-2 normal-case ${isReading || processingIndex !== null ? 'btn-disabled' : ''}`}>
                {isReading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8 opacity-40" />}
                <span className="text-sm font-bold">Select Excel Files</span>
                <input type="file" multiple accept=".xlsx" className="hidden" onChange={handleFiles} disabled={isReading || processingIndex !== null} />
            </label>
        </div>

        {/* QUEUE LIST */}
        {queue.length > 0 && (
            <div className="mt-6 space-y-2">
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                    {queue.map((item, index) => (
                        <div key={item.id} className={`
                            flex items-center gap-3 p-3 rounded-lg border transition-all
                            ${index === processingIndex ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-base-300'}
                            ${item.status === 'done' ? 'opacity-50' : ''}
                        `}>
                            {/* Status Icon */}
                            <div className="shrink-0 w-6">
                                {item.status === 'done' && <CheckCircle2 className="w-5 h-5 text-success" />}
                                {item.status === 'error' && <AlertCircle className="w-5 h-5 text-error" />}
                                {item.status === 'pending' && index === processingIndex && isUploading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                                {item.status === 'pending' && index !== processingIndex && <div className="w-2 h-2 rounded-full bg-base-content/20 mx-auto" />}
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm truncate">{item.file.name}</div>
                                {item.errorMsg && <div className="text-xs text-error">{item.errorMsg}</div>}
                            </div>

                            {/* Date */}
                            <input 
                                type="date" 
                                className="input input-sm input-bordered font-mono text-xs w-32"
                                value={item.date}
                                onChange={(e) => updateDate(item.id, e.target.value)}
                                disabled={item.status === 'done' || processingIndex !== null}
                            />
                            
                            {/* Delete */}
                            {item.status !== 'done' && processingIndex !== index && (
                                <button onClick={() => removeFile(item.id)} className="btn btn-ghost btn-xs btn-circle text-error">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* ACTIONS */}
        <div className="card-actions justify-end mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
             {processingIndex !== null && !isUploading && (
                 <div className="flex items-center gap-2 animate-pulse">
                     <span className="text-xs font-bold text-success">Import Complete!</span>
                     <button className="btn btn-sm btn-primary" onClick={processNext}>
                         Process Next File <ArrowRight className="w-4 h-4" />
                     </button>
                 </div>
             )}

             {processingIndex === null && queue.some(q => q.status === 'pending') && (
                <button 
                    className="btn btn-primary gap-2" 
                    onClick={startSequence}
                    disabled={isReading}
                >
                    <Play className="w-4 h-4" /> Start Processing
                </button>
             )}
        </div>

      </div>
    </div>
  );
}