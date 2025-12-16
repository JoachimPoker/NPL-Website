"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/import-excel", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      
      alert(`Success! Imported ${json.results_inserted} results.`);
      router.push("/admin"); // Back to dashboard to see changes
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-8 py-8 px-4">
      <div className="text-center space-y-2 border-b border-white/5 pb-6">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Import Results</h1>
        <p className="text-base-content/60">Upload your weekly Excel sheet to update the league.</p>
      </div>

      <div className="card bg-base-100 shadow-2xl border border-white/5 overflow-hidden">
        <div className="card-body p-8 sm:p-12">
          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
            
            {/* File Input Zone */}
            <div className="form-control w-full">
              <label 
                htmlFor="file-upload" 
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer bg-base-200/20 hover:bg-base-200/40 transition-all ${
                  file ? "border-primary/50" : "border-base-content/20"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {file ? (
                    <>
                      <span className="text-4xl mb-2">📄</span>
                      <p className="text-lg font-bold text-white">{file.name}</p>
                      <p className="text-sm text-base-content/60">{(file.size / 1024).toFixed(0)} KB</p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl mb-3 opacity-50">📤</span>
                      <p className="mb-2 text-sm text-base-content/60"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-base-content/40">XLSX files only (max 5MB)</p>
                    </>
                  )}
                </div>
                <input 
                  id="file-upload" 
                  type="file" 
                  accept=".xlsx" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                />
              </label>
            </div>

            <div className="w-full flex gap-3">
              <button 
                type="submit" 
                disabled={!file || uploading}
                className="btn btn-primary btn-block uppercase font-bold tracking-widest"
              >
                {uploading ? <span className="loading loading-spinner"></span> : "Start Import"}
              </button>
            </div>
          </form>
        </div>
        <div className="bg-base-200/30 p-4 text-center text-xs text-base-content/40">
          This will automatically snapshot the leaderboard after processing.
        </div>
      </div>
    </div>
  );
}