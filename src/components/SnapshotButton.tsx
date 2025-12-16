"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SnapshotButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSnapshot() {
    if (!confirm("Are you sure you want to take a leaderboard snapshot now?")) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/snapshot", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed");
      
      alert("Success! Snapshot taken.");
      router.refresh(); 
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSnapshot}
      disabled={loading}
      className="btn btn-outline btn-sm uppercase font-bold tracking-wider hover:bg-primary hover:text-black transition-all"
    >
      {loading ? (
        <>
          <span className="loading loading-spinner loading-xs"></span> Processing...
        </>
      ) : (
        "📸 Take Weekly Snapshot"
      )}
    </button>
  );
}