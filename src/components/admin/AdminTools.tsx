"use client";

import { useState } from "react";

export default function AdminTools() {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({
    results: true,
    events: true,
    players: true,
    seasons: false,
    festivals: false,
  });

  const handleReset = async () => {
    // Final safety check
    const selectedKeys = Object.entries(options)
      .filter(([_, val]) => val)
      .map(([key]) => key);

    if (selectedKeys.length === 0) return alert("Please select at least one item to delete.");
    
    const confirmMsg = `DANGER: You are about to delete: ${selectedKeys.join(", ")}. This cannot be undone. Proceed?`;
    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");

      alert("Selection cleared successfully.");
      window.location.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl border border-error/20">
      <div className="card-body">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-bold">Danger Zone</h3>
            <p className="text-xs text-base-content/60">Maintain and clean the system database.</p>
          </div>
        </div>

        {/* This button now opens the modal instead of resetting immediately */}
        <button 
          className="btn btn-error btn-outline btn-block"
          onClick={() => (document.getElementById("reset_modal") as any).showModal()}
        >
          Open Database Reset Tool
        </button>

        {/* MODAL WINDOW */}
        <dialog id="reset_modal" className="modal">
          <div className="modal-box border border-white/10 shadow-2xl">
            <h3 className="font-black text-xl uppercase tracking-tighter text-error mb-4">Granular Database Reset</h3>
            <p className="text-sm opacity-70 mb-6">Select exactly what you want to remove. Items not checked will be preserved.</p>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors">
                <span className="font-bold text-sm">Results & Positions</span>
                <input type="checkbox" className="checkbox checkbox-error" checked={options.results} onChange={() => setOptions({...options, results: !options.results})} />
              </label>

              <label className="flex items-center justify-between p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors">
                <span className="font-bold text-sm">Events (Tournament Logs)</span>
                <input type="checkbox" className="checkbox checkbox-error" checked={options.events} onChange={() => setOptions({...options, events: !options.events})} />
              </label>

              <label className="flex items-center justify-between p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors">
                <span className="font-bold text-sm">Players & Aliases</span>
                <input type="checkbox" className="checkbox checkbox-error" checked={options.players} onChange={() => setOptions({...options, players: !options.players})} />
              </label>

              <div className="divider opacity-10">CORE STRUCTURE</div>

              <label className="flex items-center justify-between p-3 bg-error/5 border border-error/10 rounded-lg cursor-pointer hover:bg-error/10 transition-colors">
                <span className="font-bold text-sm text-error">Seasons & Leagues</span>
                <input type="checkbox" className="checkbox checkbox-error" checked={options.seasons} onChange={() => setOptions({...options, seasons: !options.seasons})} />
              </label>

              <label className="flex items-center justify-between p-3 bg-error/5 border border-error/10 rounded-lg cursor-pointer hover:bg-error/10 transition-colors">
                <span className="font-bold text-sm text-error">Festivals & Series</span>
                <input type="checkbox" className="checkbox checkbox-error" checked={options.festivals} onChange={() => setOptions({...options, festivals: !options.festivals})} />
              </label>
            </div>

            <div className="modal-action mt-8">
              <form method="dialog">
                <button className="btn btn-ghost">Cancel</button>
              </form>
              <button 
                className="btn btn-error px-8" 
                onClick={handleReset}
                disabled={loading}
              >
                {loading ? "Wiping..." : "Execute Reset"}
              </button>
            </div>
          </div>
        </dialog>
      </div>
    </div>
  );
}