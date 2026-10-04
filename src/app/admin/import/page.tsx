"use client";

import { useState, useRef, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { History, UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from "lucide-react";

// --- TYPES ---
type Season = { id: number; name: string; year: number; is_active: boolean | null };

type Batch = {
  id: string;
  created_at: string;
  snapshot_date: string | null;
  filename: string;
  status: string | null;
  season_id: number | null;
  summary: Summary | null;
};

type Counts = { new: number; updated: number; removed?: number };
type NewEvent = { id: number; name: string | null; start_date: string | null; casino: string | null; is_high_roller: boolean };
type RemovedResult = { result_id: number; event: string | null; player: string; position: number | null; points: number };

type Summary = {
  season: { id: number; name: string; year: number };
  rows: number;
  snapshot_date: string | null;
  players: Counts;
  events: Counts;
  results: Counts;
  new_events: NewEvent[];
  removed_results: RemovedResult[];
  dry_run?: boolean;
};

type Preview = {
  batch_id: string;
  file: string;
  stats: { rows: number; players: number; tournaments: number; firstDate: string | null; lastDate: string | null };
  warnings: string[];
  summary: Summary;
};

type Series = { id: number; label: string };

function yearFromFilename(name: string): number | null {
  const m = name.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

// --- MAIN PAGE ---
export default function AdminImportPage() {
  const supabase = createSupabaseClient();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [history, setHistory] = useState<Batch[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState<"preview" | "apply" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [applied, setApplied] = useState<Summary | null>(null);
  const [reviewEvents, setReviewEvents] = useState<NewEvent[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("seasons")
      .select("id, name, year, is_active")
      .order("year", { ascending: false })
      .then(({ data }) => setSeasons((data as Season[]) || []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchHistory();
  }, [applied]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchHistory() {
    const { data } = await supabase
      .from("import_batches")
      .select("id, created_at, snapshot_date, filename, status, season_id, summary")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data as any);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setApplied(null);
    setError(null);
    const y = yearFromFilename(f.name);
    const match = seasons.find((s) => s.year === y);
    setSeasonId(match ? match.id : "");
  }

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
    pickFile(e.dataTransfer.files?.[0]);
  };

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !seasonId) return;
    setBusy("preview");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("seasonId", String(seasonId));

    try {
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setPreview(json as Preview);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function commit(action: "apply" | "cancel") {
    if (!preview) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/import-excel/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: preview.batch_id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      if (action === "apply") {
        setApplied(json.summary as Summary);
        if (json.summary?.new_events?.length) setReviewEvents(json.summary.new_events);
      }
      setPreview(null);
      setFile(null);
      if (action === "cancel") fetchHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const seasonName = (id: number | null) => seasons.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-content/[0.07] pb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Import results</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* LEFT: UPLOAD / PREVIEW */}
        <div className="space-y-6">
          {!preview ? (
            <div className="panel">
              <div className="card-body p-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-semibold text-lg">Weekly report</h3>
                  <span className="badge badge-primary badge-outline text-xs">RawPlayerData .xlsx</span>
                </div>
                <p className="text-xs text-base-content/60 mb-4">
                  Each report is the full season so far. Importing makes the season match the report: new results are
                  added, corrections applied and results no longer in the report removed. You&apos;ll see a preview first.
                </p>

                <form onSubmit={handlePreview} className="space-y-6">
                  {/* Drop Zone */}
                  <div
                    className={`
                      relative w-full h-40 rounded-[3px] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2
                      ${dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-base-content/10 bg-base-200/20 hover:border-primary/50 hover:bg-base-200/40"}
                      ${file ? "border-success/50 bg-success/5" : ""}
                    `}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                    {file ? (
                      <div className="text-center">
                        <FileSpreadsheet className="w-8 h-8 mx-auto text-success mb-2" />
                        <p className="text-sm font-bold text-success">{file.name}</p>
                      </div>
                    ) : (
                      <div className="text-center opacity-50">
                        <UploadCloud className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm font-bold">Drop the Excel file here</p>
                        <p className="text-xs mt-1">or click to browse</p>
                      </div>
                    )}
                  </div>

                  {/* Season */}
                  <div className="form-control">
                    <label className="label" htmlFor="season">
                      <span className="label-text text-[0.875rem] font-medium text-season-ink/85">Season</span>
                    </label>
                    <select
                      id="season"
                      className="select select-bordered bg-base-200/50 w-full"
                      value={seasonId}
                      onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : "")}
                      required
                    >
                      <option value="">Choose a season…</option>
                      {seasons.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (active)" : ""}</option>
                      ))}
                    </select>
                    <div className="text-[10px] text-base-content/40 mt-1.5 ml-1">
                      Picked from the year in the filename. Change it if that&apos;s wrong.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!file || !seasonId || busy !== null}
                    className="btn btn-primary btn-block"
                  >
                    {busy === "preview" ? <span className="loading loading-spinner"></span> : "Preview import"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <PreviewCard preview={preview} busy={busy} onApply={() => commit("apply")} onCancel={() => commit("cancel")} />
          )}

          {error && (
            <div role="alert" className="alert alert-error text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {applied && (
            <div role="status" className="alert alert-success text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Imported {applied.season.name}: {applied.results.new} new, {applied.results.updated} updated and{" "}
                {applied.results.removed ?? 0} removed results. Leaderboards are updated.
              </span>
            </div>
          )}
        </div>

        {/* RIGHT: IMPORT HISTORY */}
        <div className="space-y-6">
          <h3 className="font-display font-semibold text-lg px-1 flex items-center gap-2">
            <History className="w-4 h-4 opacity-70" /> Recent imports
          </h3>
          <div className="panel overflow-hidden">
            <table className="table table-sm w-full">
              <thead className="bg-base-200/50 text-[0.8125rem] text-base-content/50">
                <tr>
                  <th className="py-3 pl-4">Imported</th>
                  <th className="py-3">File</th>
                  <th className="py-3">Season</th>
                  <th className="py-3 text-right pr-4">Result</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 opacity-40 text-xs">No imports yet.</td></tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="border-b border-base-content/[0.07] last:border-0 hover:bg-base-200/30 transition-colors">
                      <td className="pl-4 font-mono text-xs opacity-60">{new Date(h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="font-medium text-xs truncate max-w-[150px]" title={h.filename}>{h.filename}</td>
                      <td className="text-xs">{seasonName(h.season_id)}</td>
                      <td className="pr-4 text-right text-xs">
                        {h.status === "completed" && h.summary ? (
                          <span className="font-mono text-primary">
                            +{h.summary.results.new} / ~{h.summary.results.updated} / −{h.summary.results.removed ?? 0}
                          </span>
                        ) : (
                          <span className="opacity-50">{h.status}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-base-content/40 px-1">Results: +new / ~updated / −removed</p>
        </div>
      </div>

      {reviewEvents && <NewEventsModal events={reviewEvents} onClose={() => setReviewEvents(null)} />}
    </div>
  );
}

// --- PREVIEW ---
function PreviewCard({ preview, busy, onApply, onCancel }: {
  preview: Preview;
  busy: string | null;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { summary: s, stats } = preview;
  const removed = s.results.removed ?? 0;
  const nothingChanges =
    s.players.new + s.players.updated + s.events.new + s.events.updated + (s.events.removed ?? 0) +
    s.results.new + s.results.updated + removed === 0;

  return (
    <div className="panel border-primary/30">
      <div className="card-body p-8 space-y-5">
        <div>
          <div className="eyebrow mb-2 text-primary">Preview: nothing saved yet</div>
          <h3 className="font-display font-semibold text-lg mt-1 break-all">{preview.file}</h3>
          <p className="text-xs text-base-content/60">
            {s.season.name} · {stats.rows.toLocaleString()} rows · {stats.tournaments} tournaments · {stats.players.toLocaleString()} players
            {stats.firstDate && ` · ${new Date(stats.firstDate).toLocaleDateString("en-GB")} – ${new Date(stats.lastDate!).toLocaleDateString("en-GB")}`}
          </p>
        </div>

        <table className="table table-sm">
          <thead className="text-[10px] uppercase text-base-content/50">
            <tr><th></th><th className="text-right">New</th><th className="text-right">Updated</th><th className="text-right">Removed</th></tr>
          </thead>
          <tbody className="font-mono text-sm">
            <tr><td className="font-sans">Results</td><td className="text-right">{s.results.new}</td><td className="text-right">{s.results.updated}</td><td className={`text-right ${removed ? "text-warning font-bold" : ""}`}>{removed}</td></tr>
            <tr><td className="font-sans">Tournaments</td><td className="text-right">{s.events.new}</td><td className="text-right">{s.events.updated}</td><td className="text-right">{s.events.removed ?? 0}</td></tr>
            <tr><td className="font-sans">Players</td><td className="text-right">{s.players.new}</td><td className="text-right">{s.players.updated}</td><td className="text-right">–</td></tr>
          </tbody>
        </table>

        {nothingChanges && <p className="text-sm text-base-content/60">This report matches what&apos;s already on the site.</p>}

        {removed > 0 && (
          <details className="rounded-[3px] border border-warning/30 bg-warning/5 p-3 text-xs" open={removed <= 10}>
            <summary className="cursor-pointer font-bold text-warning">
              {removed} result{removed === 1 ? "" : "s"} no longer in the report will be removed
            </summary>
            <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {s.removed_results.map((r) => (
                <li key={r.result_id}>{r.player} · {r.event ?? "Unknown event"} · #{r.position ?? "–"} · {r.points} pts</li>
              ))}
            </ul>
          </details>
        )}

        {preview.warnings.length > 0 && (
          <details className="rounded-[3px] border border-base-content/10 p-3 text-xs">
            <summary className="cursor-pointer font-bold">{preview.warnings.length} note{preview.warnings.length === 1 ? "" : "s"} about the file</summary>
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto opacity-80">
              {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={busy !== null} className="btn btn-ghost">
            {busy === "cancel" ? <span className="loading loading-spinner loading-sm"></span> : "Cancel"}
          </button>
          <button onClick={onApply} disabled={busy !== null} className="btn btn-primary px-8">
            {busy === "apply" ? <span className="loading loading-spinner"></span> : "Apply Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- REVIEW NEW EVENTS (series + high roller) ---
function NewEventsModal({ events: initial, onClose }: { events: NewEvent[]; onClose: () => void }) {
  const [events, setEvents] = useState(initial.map((e) => ({ ...e, series_id: null as number | null })));
  const [changedHr, setChangedHr] = useState<Set<number>>(new Set());
  const [changedSeries, setChangedSeries] = useState<Set<number>>(new Set());
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = createSupabaseClient();
    db.from("series")
      .select("id, name")
      .order("name")
      .then(({ data }) => setSeriesList((data || []).map((s: any) => ({ id: s.id, label: s.name }))));
    // Show the series detection picked for each new event.
    db.from("events")
      .select("id, series_id")
      .in("id", initial.map((e) => e.id))
      .then(({ data }) => {
        const detected = new Map((data || []).map((r: any) => [r.id, r.series_id as number | null]));
        setEvents((prev) => prev.map((e) => ({ ...e, series_id: detected.get(e.id) ?? null })));
      });
  }, [initial]);

  const toggleHighRoller = (id: number) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_high_roller: !e.is_high_roller } : e)));
    setChangedHr((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const changeSeries = (id: number, value: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, series_id: value ? Number(value) : null } : e)));
    setChangedSeries((prev) => new Set(prev).add(id));
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/events/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send what the admin changed; everything else stays as detected.
          updates: events
            .filter((e) => changedSeries.has(e.id) || changedHr.has(e.id))
            .map((e) => ({
              id: e.id,
              ...(changedSeries.has(e.id) ? { series_id: e.series_id } : {}),
              ...(changedHr.has(e.id) ? { is_high_roller: e.is_high_roller } : {}),
            })),
        }),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      onClose();
    } catch {
      alert("Error saving updates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="new-events-title" className="panel w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-base-content/[0.07] flex justify-between items-center bg-base-200/50 rounded-t-2xl">
          <div>
            <h3 id="new-events-title" className="font-display font-semibold text-lg">New tournaments</h3>
            <p className="text-xs text-base-content/60">
              {events.length} new tournament{events.length === 1 ? "" : "s"}. Assign a series, and check High Roller (set from the name).
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle" aria-label="Close"><X size={16} aria-hidden="true" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="table w-full">
            <thead className="bg-base-200/50 sticky top-0 z-10 text-[0.8125rem] font-medium">
              <tr>
                <th className="pl-6">Tournament</th>
                <th>Series</th>
                <th className="text-center">High Roller?</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-base-content/[0.07] hover:bg-base-200/20">
                  <td className="pl-6 py-4">
                    <div className="font-bold text-sm">{e.name}</div>
                    <div className="text-xs opacity-50">
                      {e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : "No date"} • {e.casino}
                    </div>
                  </td>
                  <td>
                    <select
                      className="select select-bordered select-sm w-full max-w-xs text-xs"
                      value={e.series_id ?? ""}
                      onChange={(ev) => changeSeries(e.id, ev.target.value)}
                      aria-label={`Series for ${e.name}`}
                    >
                      <option value="">-- No Series --</option>
                      {seriesList.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={e.is_high_roller}
                      onChange={() => toggleHighRoller(e.id)}
                      aria-label={`${e.name} is a High Roller event`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-base-content/[0.07] bg-base-200/30 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost">Skip</button>
          <button onClick={saveChanges} disabled={saving} className="btn btn-primary px-8">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
