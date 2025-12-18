"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateEventsAction } from "./actions"; // Import the action

// Type Definition
type Event = {
  id: number; // Changed to number to match your DB (was string in some places, number in others. Adjust if needed)
  name: string;
  start_date: string | null;
  is_high_roller: boolean | null;
  series: { name: string } | { name: string }[] | null; 
};

export default function EventsTable({ events }: { events: Event[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition(); // New Hook

  // Toggle Single Row
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toggle All
  const toggleAll = () => {
    if (selectedIds.length === events.length) {
      setSelectedIds([]); 
    } else {
      setSelectedIds(events.map(e => e.id)); 
    }
  };

  // Handle Bulk Update via Server Action
  const handleBulkUpdate = (updates: { is_high_roller: boolean }) => {
    if (!confirm(`Update ${selectedIds.length} events?`)) return;

    startTransition(async () => {
      try {
        await bulkUpdateEventsAction(selectedIds, updates);
        
        // Success Logic
        setSelectedIds([]); // Clear selection
        // Router refresh is handled automatically by revalidatePath in the action, 
        // but we can call it explicitly if needed.
      } catch (e: any) {
        alert("Error: " + e.message);
      }
    });
  };

  // Helper
  const getSeriesName = (series: Event['series']) => {
    if (!series) return "—";
    if (Array.isArray(series)) return series[0]?.name || "—";
    return series.name;
  };

  return (
    <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden relative">
      
      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-primary text-primary-content p-2 px-4 flex justify-between items-center animate-in slide-in-from-top-2">
          <div className="font-bold text-sm">
            {selectedIds.length} Selected
          </div>
          <div className="flex gap-2">
            <button 
              className="btn btn-sm btn-white text-primary border-0 font-bold uppercase"
              onClick={() => handleBulkUpdate({ is_high_roller: true })}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Set High Roller"}
            </button>
            <button 
              className="btn btn-sm btn-ghost border-white/20 border font-bold uppercase"
              onClick={() => handleBulkUpdate({ is_high_roller: false })}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Set NPL"}
            </button>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setSelectedIds([])}>✕</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-lg w-full">
          <thead>
            <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
              <th className="w-10 text-center">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-xs" 
                  checked={events.length > 0 && selectedIds.length === events.length}
                  onChange={toggleAll}
                />
              </th>
              <th>Date</th>
              <th>Event</th>
              <th className="hidden sm:table-cell">Series</th>
              <th className="text-center">Type</th>
            </tr>
          </thead>
          <tbody className={isPending ? "opacity-50 pointer-events-none" : ""}>
            {!events?.length ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-base-content/50 italic">
                  No events found.
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const isSelected = selectedIds.includes(e.id);
                return (
                  <tr 
                    key={e.id} 
                    className={`
                      hover:bg-base-200/30 transition-colors border-b border-white/5 last:border-0 cursor-pointer
                      ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : ''}
                    `}
                    onClick={() => toggleSelection(e.id)}
                  >
                    <td className="text-center" onClick={(ev) => ev.stopPropagation()}>
                       <input 
                         type="checkbox" 
                         className="checkbox checkbox-xs" 
                         checked={isSelected}
                         onChange={() => toggleSelection(e.id)}
                       />
                    </td>
                    <td className="font-mono text-xs opacity-60 align-top pt-4">
                        {e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="align-top">
                      <div className="font-bold text-white min-w-[200px] leading-tight">
                        {e.name}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-sm opacity-70 align-top pt-4">
                      {getSeriesName(e.series)}
                    </td>
                    <td className="text-center align-top pt-4">
                        {e.is_high_roller ? (
                            <span className="badge badge-xs badge-secondary font-bold uppercase">High Roller</span>
                        ) : (
                            <span className="badge badge-xs badge-ghost opacity-50">NPL</span>
                        )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}