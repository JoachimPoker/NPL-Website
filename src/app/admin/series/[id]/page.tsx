"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

/* ------------ Types ------------- */
type Festival = {
  id: string;
  series_id: number;
  label: string;
  city: string | null;
  start_date: string;
  end_date: string;
};

type EventRow = {
  id: string;
  tournament_name?: string | null; // from events.name
  start_date?: string | null;
  series_id: number | null;
  festival_id: string | null;
};

type Series = { id: number; name: string; slug?: string };

/* ------------ Small utilities ------------- */
function ymdToDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmt(date: string) {
  return date;
}
function cmpDateAsc(a: EventRow, b: EventRow) {
  const da = ymdToDate(a.start_date)!.getTime();
  const db = ymdToDate(b.start_date)!.getTime();
  return da - db;
}

/* ------------ Label/City inference helpers ------------- */

// words to remove from label candidates
const STOPWORDS = new Set([
  "event", "the", "no", "opener", "closer", "mini", "super",
  "turbo", "flight", "re-entry", "bounty", "gtd", "seat", "free",
  "added", "ante", "mystery", "pko", "pkb", "rebuy", "re", "main",
  "dragon", "high", "roller", "plo", "card", "holdem", "nlh", "nl",
  "day", "flight", "stack", "deepstack", "mega", "satellite", "sat",
]);

// common UK series cities (extend as needed)
const KNOWN_CITIES = [
  "Coventry","Manchester","Leeds","London","Sheffield","Bolton","Reading",
  "Liverpool","Luton","Blackpool","Nottingham","Birmingham","Glasgow",
  "Newcastle","Bristol","Edinburgh","Cardiff","Brighton"
];

// a safe trailing-separators regex (unicode aware)
const TAIL_SEPS = /[\u2013\u2014\-:,]+$/u; // en dash, em dash, hyphen, colon, comma

// strip money, numbers, parentheses, punctuation
function normalizeName(raw?: string | null): string {
  const s = (raw || "").toLowerCase();
  // remove £ and money / numbers like 50,000 / 10k / 25/50 etc
  let t = s.replace(/£?\s?\d[\d,]*(k|gtd)?/g, " ");
  t = t.replace(/\(.*?\)/g, " "); // remove parenthetical
  t = t.replace(/[\d/:-]/g, " "); // remaining numbers / separators
  t = t.replace(/[^\p{L}\s'-]/gu, " "); // anything non-letter
  // collapse spaces
  t = t.replace(/\s+/g, " ").trim();

  // drop stopwords
  const words = t.split(" ").filter(w => w && !STOPWORDS.has(w));
  return words.join(" ");
}

function longestCommonPrefixStr(list: string[]): string {
  if (!list.length) return "";
  let prefix = list[0];
  for (let i = 1; i < list.length; i++) {
    let j = 0;
    while (j < prefix.length && j < list[i].length && prefix[j] === list[i][j]) j++;
    prefix = prefix.slice(0, j);
    if (!prefix) break;
  }
  return prefix.trim();
}

function titleCase(s: string) {
  return s.replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1));
}

function inferCityFromNames(names: string[]): string | null {
  const counts = new Map<string, number>();
  for (const n of names) {
    const words = n.split(/[\s-]+/).map(w => w.replace(/[^A-Za-z]/g, ""));
    for (const w of words) {
      const cap = w[0]?.toUpperCase() + w.slice(1).toLowerCase();
      if (KNOWN_CITIES.includes(cap)) {
        counts.set(cap, (counts.get(cap) || 0) + 1);
      }
    }
  }
  let best: string | null = null;
  let max = 0;
  counts.forEach((v, k) => {
    if (v > max) { max = v; best = k; }
  });
  return best;
}

function deriveLabelAndCity(seriesName: string, eventNames: string[]) {
  const cleaned = eventNames.map(normalizeName).filter(Boolean);
  let label = "";
  let city: string | null = null;

  if (cleaned.length) {
    const prefix = longestCommonPrefixStr(cleaned);
    if (prefix && prefix.split(" ").join("").length >= 3) {
      label = titleCase(prefix).replace(TAIL_SEPS, "").trim();
    }
  }

  // City inference
  city = inferCityFromNames(eventNames) || null;

  if (!label) {
    label = seriesName;
    if (city) label += ` ${city}`;
  }
  label = label.replace(TAIL_SEPS, "").trim();
  return { label, city };
}

/* ------------ Cluster logic ------------- */
type Cluster = {
  start: string; end: string;
  events: EventRow[];
  label: string; city: string | null;
};

function buildClusters(
  events: EventRow[],
  seriesName: string,
  dayGap: number,
  minSize: number
) {
  const sorted = [...events].sort(cmpDateAsc);
  const clusters: Cluster[] = [];
  let cur: EventRow[] = [];

  const flush = () => {
    if (!cur.length) return;
    const start = cur[0].start_date!;
    const end = cur[cur.length - 1].start_date!;
    const names = cur.map(e => e.tournament_name || "");
    const { label, city } = deriveLabelAndCity(seriesName, names);
    clusters.push({ start, end, events: cur, label, city });
    cur = [];
  };

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (!e.start_date) continue;
    if (!cur.length) { cur = [e]; continue; }

    const prev = cur[cur.length - 1];
    const d1 = ymdToDate(prev.start_date)!.getTime();
    const d2 = ymdToDate(e.start_date)!.getTime();
    const diff = Math.abs(d2 - d1) / (24 * 3600 * 1000);

    if (diff <= dayGap) cur.push(e);
    else { flush(); cur = [e]; }
  }
  flush();

  const big = clusters.filter(c => c.events.length >= minSize);
  const small = clusters.filter(c => c.events.length < minSize);
  return { clusters, big, small };
}

/* ------------ Page ------------- */
export default function ManageSeriesPage() {
  const params = useParams();
  const raw = String(params?.id || "").trim();

  const [series, setSeries] = useState<Series | null>(null);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // auto festival controls
  const [gap, setGap] = useState(3);        // gap in days
  const [minSize, setMinSize] = useState(3);
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  // festival editing
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{label:string; city:string; start_date:string; end_date:string}>({
    label: "", city: "", start_date: "", end_date: ""
  });

  const load = async () => {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      // resolve series
      const sRes = await fetch("/api/admin/series/list", { cache: "no-store" });
      const sJson = await sRes.json();
      if (!sRes.ok) throw new Error(sJson?._error || sRes.statusText);
      const list = (sJson.series || []) as Series[];
      const sid = Number(raw);
      const srs = list.find(x => x.id === sid) || null;
      if (!srs) throw new Error("Series not found");
      setSeries(srs);

      // festivals
      const fRes = await fetch(`/api/admin/festivals/list?series_id=${srs.id}`, { cache: "no-store" });
      const fJson = await fRes.json();
      if (!fRes.ok) throw new Error(fJson?._error || fRes.statusText);
      setFestivals(fJson.festivals || []);

      // events in this series
      const evRes = await fetch(`/api/admin/series/${srs.id}/events`, { cache: "no-store" });
      const evJson = await evRes.json();
      if (!evRes.ok) throw new Error(evJson?._error || evRes.statusText);
      setEvents((evJson.events || []) as EventRow[]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [raw]);

  const seriesName = series?.name || "Series";
  const { clusters, big } = useMemo(
    () => buildClusters(events, seriesName, gap, minSize),
    [events, seriesName, gap, minSize]
  );

  useEffect(() => {
    const map: Record<number, boolean> = {};
    clusters.forEach((c, i) => { map[i] = c.events.length >= minSize; });
    setSelected(map);
  }, [clusters, minSize]);

  const anyAssigned = (festivals || []).length > 0;

  async function createFestivalOne(series_id: number, c: Cluster) {
    const res = await fetch("/api/admin/festivals/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        series_id,
        label: c.label,
        city: c.city || null,
        start_date: c.start,
        end_date: c.end,
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?._error || res.statusText);
    const festId = j?.festival?.id || j?.id || j?.festival_id;
    if (!festId) throw new Error("Festival id missing in response");

    // auto-assign its events
    for (const ev of c.events) {
      const r = await fetch("/api/admin/festivals/assign-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: ev.id,
          series_id,
          festival_id: festId,
        }),
      });
      const jj = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(jj?._error || r.statusText);
    }
  }

  const createSelected = async () => {
    if (!series) return;
    setLoading(true);
    setErr(null); setOk(null);
    try {
      const chosen = clusters.filter((_, i) => selected[i]);
      if (!chosen.length) throw new Error("Nothing selected.");
      for (const c of chosen) {
        await createFestivalOne(series.id, c);
      }
      setOk(`Created ${chosen.length} festival(s) and assigned ${chosen.reduce((a,c)=>a+c.events.length,0)} events.`);
      await load();
    } catch (e:any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const assignEvent = async (event_id: string, festival_id: string | "none") => {
    if (!series) return;
    setErr(null); setOk(null);
    const res = await fetch("/api/admin/festivals/assign-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id,
        series_id: series.id,
        festival_id: festival_id === "none" ? null : festival_id,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(j?._error || res.statusText); return; }
    setOk("Event updated.");
    await load();
  };

  const changeSeries = async (event_id: string, series_slug: string | "none") => {
    setErr(null); setOk(null);
    const res = await fetch("/api/admin/series/change-series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id,
        series_slug: series_slug === "none" ? null : series_slug,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(j?._error || res.statusText); return; }
    setOk("Series changed.");
    await load();
  };

  // --------- edit handlers ----------
  const startEdit = (f: Festival) => {
    setEditId(f.id);
    setEditForm({
      label: f.label || "",
      city: f.city || "",
      start_date: f.start_date,
      end_date: f.end_date,
    });
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ label: "", city: "", start_date: "", end_date: "" });
  };
  const saveEdit = async () => {
    if (!editId) return;
    setLoading(true);
    setErr(null); setOk(null);
    try {
      const res = await fetch("/api/admin/festivals/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editId,
          label: editForm.label.trim(),
          city: editForm.city.trim() || null,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?._error || res.statusText);
      setOk("Festival updated.");
      cancelEdit();
      await load();
    } catch (e:any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteFestival = async (id: string) => {
    if (!confirm("Delete this festival? Events will keep their series but lose the festival assignment.")) return;
    setLoading(true);
    setErr(null); setOk(null);
    try {
      const res = await fetch("/api/admin/festivals/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?._error || res.statusText);
      setOk("Festival deleted.");
      await load();
    } catch (e:any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Admin — Manage Series {series?.name ?? `#${raw}`}</h1>
          <div className="text-xs text-gray-600">
            {festivals.length} festivals · {events.length} events
          </div>
        </div>
        <div className="flex gap-2">
          <a className="text-sm underline" href="/admin/series">Back to Series</a>
          <button className="border rounded px-3 py-1" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>

      {err && <div className="p-2 bg-red-100 text-red-700 text-sm rounded">{err}</div>}
      {ok && <div className="p-2 bg-green-100 text-green-700 text-sm rounded">{ok}</div>}

      {/* Auto-create block */}
      <div className="border rounded bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <b>Auto-create Festivals (preview → create + auto-assign)</b>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Gap:
              <select className="border rounded px-2 py-1"
                value={gap}
                onChange={e => setGap(Number(e.target.value))}
              >
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Min size:
              <select className="border rounded px-2 py-1"
                value={minSize}
                onChange={e => setMinSize(Number(e.target.value))}
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
            <button
              className="border rounded px-3 py-1"
              onClick={createSelected}
              disabled={loading || !Object.values(selected).some(Boolean)}
            >
              Create selected
            </button>
          </div>
        </div>

        <div className="p-4 overflow-x-auto text-sm">
          {!clusters.length ? (
            <p className="text-gray-600">No events available for clustering.</p>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left">Use</th>
                  <th className="text-left">Label</th>
                  <th className="text-left">City</th>
                  <th className="text-left">Dates</th>
                  <th className="text-left">Events</th>
                  <th className="text-left">Examples</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((c, i) => {
                  const examples = c.events.slice(0, 3).map(e => e.tournament_name || "").join(" · ");
                  const isSmall = c.events.length < minSize;
                  return (
                    <tr key={i} className={isSmall ? "opacity-70" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[i]}
                          onChange={(e) => setSelected(s => ({ ...s, [i]: e.target.checked }))}
                        />
                      </td>
                      <td>{c.label}</td>
                      <td>{c.city || "—"}</td>
                      <td>{fmt(c.start)} → {fmt(c.end)}</td>
                      <td>{c.events.length}</td>
                      <td className="max-w-[520px] truncate" title={examples}>{examples}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="text-xs text-gray-600 mt-2">
            Preview: {clusters.length} cluster(s) found. <b>{big.length}</b> meet the minimum size ({minSize}+).
          </div>
        </div>
      </div>

      {/* Existing festivals list — with inline edit */}
      <div className="border rounded bg-white overflow-hidden">
        <div className="px-4 py-3 border-b">
          <b>Festivals</b>
        </div>
        <div className="p-4 overflow-x-auto">
          {!festivals.length ? (
            <p className="text-sm text-gray-600">No festivals for this series yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Label</th>
                  <th className="text-left">City</th>
                  <th className="text-left">Start</th>
                  <th className="text-left">End</th>
                  <th className="text-left w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {festivals.map(f => {
                  const isEditing = editId === f.id;
                  return (
                    <tr key={f.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={editForm.label}
                            onChange={(e) => setEditForm(s => ({ ...s, label: e.target.value }))}
                          />
                        ) : f.label}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={editForm.city}
                            onChange={(e) => setEditForm(s => ({ ...s, city: e.target.value }))}
                            placeholder="optional"
                          />
                        ) : (f.city || "—")}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={editForm.start_date}
                            onChange={(e) => setEditForm(s => ({ ...s, start_date: e.target.value }))}
                          />
                        ) : f.start_date}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={editForm.end_date}
                            onChange={(e) => setEditForm(s => ({ ...s, end_date: e.target.value }))}
                          />
                        ) : f.end_date}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button className="border rounded px-2 py-1" onClick={saveEdit} disabled={loading}>Save</button>
                            <button className="border rounded px-2 py-1" onClick={cancelEdit} disabled={loading}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button className="border rounded px-2 py-1" onClick={() => startEdit(f)} disabled={loading}>Edit</button>
                            <button className="border rounded px-2 py-1" onClick={() => deleteFestival(f.id)} disabled={loading}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Events table with manual assignment controls */}
      <div className="border rounded bg-white overflow-hidden">
        <div className="px-4 py-3 border-b">
          <b>Assigned Events</b>
        </div>
        <div className="p-4 overflow-x-auto">
          {!events.length ? (
            <p className="text-sm text-gray-600">No events yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Start</th>
                  <th className="text-left">Tournament</th>
                  <th className="text-left">Festival</th>
                  <th className="text-left">Series</th>
                </tr>
              </thead>
              <tbody>
                {events.sort(cmpDateAsc).map(ev => (
                  <tr key={ev.id}>
                    <td>{ev.start_date || "—"}</td>
                    <td>{ev.tournament_name || "—"}</td>
                    <td>
                      <select
                        className="border rounded px-2 py-1"
                        value={ev.festival_id || "none"}
                        onChange={(e) => assignEvent(ev.id, e.target.value as any)}
                      >
                        <option value="none">— none —</option>
                        {festivals.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.label} ({f.start_date} → {f.end_date})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="border rounded px-2 py-1"
                        onChange={(e) => changeSeries(ev.id, e.target.value as any)}
                      >
                        <option value="none">— keep —</option>
                        <option value="gukpt">GUKPT</option>
                        <option value="minifest">Mini Fest</option>
                        <option value="888live">888Live</option>
                        <option value="ukpl">UKPL</option>
                        <option value="online">Online</option>
                        <option value="2550">25/50</option>
                        <option value="goliath">Goliath</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!anyAssigned && (
            <p className="text-xs text-gray-500 mt-2">
              Tip: Use the Auto-create block above to create festivals, then assign here (or let the button auto-assign).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
