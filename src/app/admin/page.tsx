"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [snapping, setSnapping] = useState(false);
  const [wiping, setWiping] = useState(false);

  // ... (takeSnapshot function from before) ...
  const takeSnapshot = async () => { /* code from previous message */ };

  const handleReset = async () => {
    if (!confirm("⚠️ DANGER ZONE ⚠️\n\nThis will delete ALL players, events, results, and seasons.\n\nAre you sure?")) return;
    if (!confirm("Seriously, there is no undo button.\n\nType 'DELETE' into the console if you were a coder, but just click OK here to wipe everything.")) return;
    
    setWiping(true);
    try {
      const res = await fetch("/api/admin/reset-db", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        alert("Database has been reset. You have a clean slate.");
        window.location.reload();
      } else {
        alert("Error: " + json.error);
      }
    } catch (e) { alert("Connection Error"); }
    setWiping(false);
  };

  return (
    <div className="container mx-auto py-12 px-4 space-y-8">
      <h1 className="text-4xl font-black uppercase italic">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Existing Links */}
        <Link href="/admin/seasons" className="card bg-base-100 shadow-xl border border-white/5 hover:border-primary transition-colors p-6">
          <h3 className="font-bold text-lg">Manage Seasons</h3>
          <p className="text-sm opacity-50">Create leagues, set dates.</p>
        </Link>
        <Link href="/admin/events" className="card bg-base-100 shadow-xl border border-white/5 hover:border-primary transition-colors p-6">
          <h3 className="font-bold text-lg">Manage Events</h3>
          <p className="text-sm opacity-50">Edit names, set High Roller status.</p>
        </Link>
        <Link href="/admin/import" className="card bg-base-100 shadow-xl border border-white/5 hover:border-primary transition-colors p-6">
          <h3 className="font-bold text-lg">Import Results</h3>
          <p className="text-sm opacity-50">Upload Excel files.</p>
        </Link>
      </div>

      <div className="divider opacity-10">MAINTENANCE</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SNAPSHOT CARD */}
        <div className="card bg-base-100 shadow-xl border border-white/5 p-6">
          <h3 className="font-bold text-lg text-warning">Daily Actions</h3>
          <p className="text-sm opacity-50 mb-4">Update "Biggest Movers" by saving history.</p>
          <button 
            className="btn btn-sm btn-outline btn-warning uppercase font-bold w-full" 
            onClick={takeSnapshot} 
            disabled={snapping}
          >
            {snapping ? "Saving..." : "📸 Save Daily Snapshot"}
          </button>
        </div>

        {/* DANGER ZONE CARD */}
        <div className="card bg-error/10 shadow-xl border border-error/20 p-6">
          <h3 className="font-bold text-lg text-error">Danger Zone</h3>
          <p className="text-sm opacity-50 mb-4">Delete all data to start fresh.</p>
          <button 
            className="btn btn-sm btn-error uppercase font-bold w-full text-white" 
            onClick={handleReset} 
            disabled={wiping}
          >
            {wiping ? "Deleting..." : "💀 Reset Database"}
          </button>
        </div>
      </div>
    </div>
  );
}