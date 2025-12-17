"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminTools() {
  const [snapping, setSnapping] = useState(false);
  const [wiping, setWiping] = useState(false);
  const router = useRouter();

  const handleSnapshot = async () => {
    setSnapping(true);
    try {
      const res = await fetch("/api/admin/snapshot", { method: "POST" });
      const json = await res.json();
      if (json.ok) alert("✅ Snapshot saved! Leaderboards updated.");
      else alert("❌ Error: " + json.error);
    } catch (e) { alert("Connection Error"); }
    setSnapping(false);
  };

  const handleReset = async () => {
    if (!confirm("⚠️ DANGER ZONE ⚠️\n\nThis will delete ALL players, events, results, and seasons.\n\nAre you sure?")) return;
    if (!confirm("This cannot be undone. Click OK to wipe everything.")) return;
    
    setWiping(true);
    try {
      const res = await fetch("/api/admin/reset-db", { method: "POST" });
      if (res.ok) {
        alert("♻️ Database wiped clean.");
        router.refresh();
      } else {
        alert("Error wiping database.");
      }
    } catch (e) { alert("Connection Error"); }
    setWiping(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* SNAPSHOT */}
      <div className="card bg-base-100 shadow-xl border border-warning/20">
        <div className="card-body p-6">
          <h3 className="card-title text-base font-bold uppercase tracking-widest text-warning flex items-center gap-2">
            📸 Manual Override
          </h3>
          <p className="text-xs text-base-content/60">
            Force a leaderboard snapshot. Use this if you edited results manually and want arrows to update immediately.
          </p>
          <div className="card-actions justify-end mt-4">
            <button 
                onClick={handleSnapshot}
                disabled={snapping}
                className="btn btn-sm btn-outline btn-warning w-full sm:w-auto"
            >
                {snapping ? <span className="loading loading-spinner loading-xs"></span> : "Update Standings"}
            </button>
          </div>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="card bg-error/5 shadow-xl border border-error/20">
        <div className="card-body p-6">
          <h3 className="card-title text-base font-bold uppercase tracking-widest text-error flex items-center gap-2">
            💀 Danger Zone
          </h3>
          <p className="text-xs text-error/60">
            Nuclear option. Wipes all data to start a fresh season or test run.
          </p>
          <div className="card-actions justify-end mt-4">
            <button 
                onClick={handleReset}
                disabled={wiping}
                className="btn btn-sm btn-error text-white w-full sm:w-auto"
            >
                {wiping ? "Deleting..." : "Reset Database"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}