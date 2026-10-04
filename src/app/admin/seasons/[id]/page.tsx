"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* --- Types --- */
type Season = {
  id?: number;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  leagues?: League[];
};

type League = {
  id?: number;
  season_id?: number;
  label: string;
  slug: string;
  scoring_method: string; 
  scoring_cap: number;
  filter_is_high_roller: boolean | null;
  max_buy_in: number | null; // ✅ New Field
  league_bonuses?: Bonus[];
};

type Bonus = {
  bonus_type: string;
  points_value: number;
};

/* --- Main Page Component --- */
export default function AdminSeasonDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const isNew = id === "create";
  const router = useRouter();

  const [season, setSeason] = useState<Season>({
    label: "", start_date: "", end_date: "", is_active: false, leagues: []
  });
  const [loading, setLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);

  // Load Data
  useEffect(() => {
    if (!isNew) loadSeason();
  }, [id]);

  async function loadSeason() {
    const res = await fetch(`/api/admin/seasons/get?id=${id}`);
    const data = await res.json();
    if (data.season) setSeason(data.season);
  }

  // Save Season Basic Info
  async function saveSeason() {
    setLoading(true);
    try {
      const url = isNew ? "/api/admin/seasons/create" : "/api/admin/seasons/update";
      const payload = {
        id: isNew ? undefined : Number(id),
        label: season.label,
        start_date: season.start_date,
        end_date: season.end_date,
        is_active: season.is_active
      };

      const res = await fetch(url, { method: "POST", body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      
      if (isNew) router.push("/admin/seasons");
      else {
        alert("Season settings updated!");
        loadSeason();
      }
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-base-content/[0.07] pb-4">
        <div>
          <Link href="/admin/seasons" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-season-ink/75 hover:text-season-ink"><span aria-hidden="true">←</span> Seasons</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{isNew ? "Create Season" : season.label}</h1>
        </div>
        <Link href="/admin/seasons" className="btn btn-sm btn-ghost">← Seasons</Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Col: Season Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="panel p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Season settings</h3>
            
            <div className="form-control">
              <label className="label text-xs font-bold">Name</label>
              <input className="input input-bordered input-sm" value={season.label} onChange={e => setSeason({...season, label: e.target.value})} placeholder="e.g. 2025 Season" />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="form-control">
                <label className="label text-xs font-bold">Start</label>
                <input type="date" className="input input-bordered input-sm" value={season.start_date} onChange={e => setSeason({...season, start_date: e.target.value})} />
              </div>
              <div className="form-control">
                <label className="label text-xs font-bold">End</label>
                <input type="date" className="input input-bordered input-sm" value={season.end_date} onChange={e => setSeason({...season, end_date: e.target.value})} />
              </div>
            </div>

            <div className="form-control">
              <label className="cursor-pointer label justify-start gap-2">
                <input type="checkbox" className="toggle toggle-success toggle-sm" checked={season.is_active} onChange={e => setSeason({...season, is_active: e.target.checked})} />
                <span className="text-sm font-bold">Active season</span>
              </label>
            </div>

            <button className="btn btn-primary btn-sm w-full" onClick={saveSeason} disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        {/* Right Col: Leagues Manager */}
        {!isNew && (
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                 <h3 className="font-display font-semibold text-2xl">Leagues</h3>
                 <p className="text-xs opacity-50">Manage the different leaderboards for this season.</p>
              </div>
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => {
                   setEditingLeague({ 
                     season_id: Number(id), label: "", slug: "", scoring_method: "total", scoring_cap: 10, 
                     filter_is_high_roller: null, max_buy_in: null 
                   } as any);
                   setModalOpen(true);
                }}
              >
                + Add league
              </button>
            </div>

            {/* Leagues List */}
            <div className="space-y-4">
              {season.leagues?.length === 0 && <div className="text-center p-8 opacity-50 border border-dashed border-base-content/10 rounded-[3px]">No leagues yet. Add one to get started.</div>}
              
              {season.leagues?.map((league) => (
                <div key={league.id} className="panel hover:border-primary/50 transition-colors cursor-pointer group"
                   onClick={() => { setEditingLeague(league); setModalOpen(true); }}
                >
                  <div className="card-body p-4 flex-row justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{league.label}</h4>
                      <div className="text-xs opacity-60 flex gap-3 mt-1 font-mono">
                         <span>/{league.slug}</span>
                         <span>•</span>
                         <span>{league.scoring_method === 'capped' ? `Best ${league.scoring_cap}` : 'Total Points'}</span>
                         
                         {/* ✅ Dynamic Badge Display */}
                         {league.filter_is_high_roller === true && (
                           <span className="text-secondary font-bold">• High Roller Only</span>
                         )}
                         {league.max_buy_in && (
                           <span className="text-success font-bold">• Under £{league.max_buy_in}</span>
                         )}
                         {league.filter_is_high_roller === null && !league.max_buy_in && (
                           <span className="opacity-50">• All Events</span>
                         )}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-ghost">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* League Editor Modal */}
      {modalOpen && editingLeague && (
        <LeagueModal 
          league={editingLeague} 
          seasonId={Number(id)}
          onClose={() => setModalOpen(false)} 
          onSave={() => { setModalOpen(false); loadSeason(); }} 
        />
      )}
    </div>
  );
}

/* --- League Modal Component --- */
function LeagueModal({ league, seasonId, onClose, onSave }: { league: League, seasonId: number, onClose: () => void, onSave: () => void }) {
  const getBonus = (type: string) => league.league_bonuses?.find(b => b.bonus_type === type)?.points_value || 0;

  // Determine initial state for the criteria selector
  let initialCriteria = "all";
  if (league.filter_is_high_roller === true) initialCriteria = "hr";
  else if (league.max_buy_in !== null) initialCriteria = "buyin";

  const [criteria, setCriteria] = useState(initialCriteria);
  
  const [form, setForm] = useState({
    ...league,
    season_id: seasonId,
    bonus_b2b: getBonus('back_to_back_wins'),
    bonus_over_cap: getBonus('participation_after_cap'),
    // Ensure numeric default for input, even if null in DB
    max_buy_in: league.max_buy_in || 0 
  });
  
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const url = league.id ? "/api/admin/leagues/update" : "/api/admin/leagues/create";
    
    // Logic to set database fields based on the dropdown choice
    const payload = { 
      ...form,
      // 1. All Events: HR filter null, Buyin null
      filter_is_high_roller: criteria === "hr" ? true : null,
      max_buy_in: criteria === "buyin" ? Number(form.max_buy_in) : null
    };
    
    try {
      const res = await fetch(url, { method: "POST", body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      
      onSave();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="panel relative w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <h3 className="font-display font-semibold text-lg border-b border-base-content/[0.07] pb-2">
          {league.id ? "Edit League" : "New League"}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
                <label className="label text-xs font-bold opacity-50">League Name</label>
                <input className="input input-bordered" value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="e.g. Global" />
            </div>
            <div className="form-control">
                <label className="label text-xs font-bold opacity-50">URL Slug</label>
                <input className="input input-bordered" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="e.g. global" />
            </div>
        </div>

        <div className="divider text-xs text-base-content/40">Scoring rules</div>

        <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
                <label className="label text-xs font-bold opacity-50">Method</label>
                <select className="select select-bordered" value={form.scoring_method} onChange={e => setForm({...form, scoring_method: e.target.value})}>
                    <option value="total">Total Accumulator</option>
                    <option value="capped">Capped (Best X)</option>
                </select>
            </div>
             <div className="form-control">
                <label className="label text-xs font-bold opacity-50">Cap (if capped)</label>
                <input type="number" className="input input-bordered" value={form.scoring_cap} onChange={e => setForm({...form, scoring_cap: Number(e.target.value)})} disabled={form.scoring_method !== 'capped'} />
            </div>
        </div>

        {/* ✅ UPDATED FILTERS SECTION */}
        <div className="divider text-xs text-base-content/40">Filters</div>

        <div className="form-control">
            <label className="label text-xs font-bold opacity-50">Included Events</label>
            <select className="select select-bordered w-full" value={criteria} onChange={e => setCriteria(e.target.value)}>
                <option value="all">All Events (No Restrictions)</option>
                <option value="hr">High Rollers Only</option>
                <option value="buyin">Under Buy-in Amount</option>
            </select>
        </div>

        {criteria === "buyin" && (
          <div className="form-control">
             <label className="label text-xs font-bold opacity-50">Max Buy-in (Currency agnostic)</label>
             <div className="join">
                <span className="btn btn-disabled join-item">&lt;</span>
                <input 
                  type="number" 
                  className="input input-bordered join-item w-full" 
                  value={form.max_buy_in} 
                  onChange={e => setForm({...form, max_buy_in: Number(e.target.value)})} 
                  placeholder="1000"
                />
             </div>
             <div className="text-[10px] opacity-50 mt-1 pl-1">Events with buy-in LESS THAN this value will count.</div>
          </div>
        )}

        <div className="divider text-xs text-base-content/40">Bonuses</div>
        
        <div className="grid grid-cols-2 gap-4">
             <div className="form-control">
                <label className="label text-xs font-bold opacity-50">Back-to-Back Win</label>
                <div className="join">
                    <input type="number" className="input input-bordered join-item w-full" value={form.bonus_b2b} onChange={e => setForm({...form, bonus_b2b: Number(e.target.value)})} />
                    <span className="btn btn-disabled join-item text-xs">Pts</span>
                </div>
            </div>
             <div className="form-control">
                <label className="label text-xs font-bold opacity-50">Per Result Over Cap</label>
                <div className="join">
                    <input type="number" className="input input-bordered join-item w-full" value={form.bonus_over_cap} onChange={e => setForm({...form, bonus_over_cap: Number(e.target.value)})} disabled={form.scoring_method !== 'capped'} />
                    <span className="btn btn-disabled join-item text-xs">Pts</span>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save League"}</button>
        </div>
      </div>
    </div>
  );
}