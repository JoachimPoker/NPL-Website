"use client";
import { useState } from "react";

export default function ImportExcelPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>('input[type="file"][name="files"]');
    if (!input?.files?.length) {
      setMsg("Choose one or more .xlsx files.");
      return;
    }
    const body = new FormData();
    for (const f of Array.from(input.files)) body.append("files", f);

    try {
      setBusy(true);
      const res = await fetch("/api/admin/import-excel", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMsg(
        `OK • events upserted: ${data.events_upserted}, results inserted: ${data.results_inserted}, tournaments replaced: ${data.tournaments_replaced}`
      );
      form.reset();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Weekly Excel Import</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border p-4">
        <input type="file" name="files" accept=".xlsx" multiple className="block w-full" />
        <button className="rounded-xl border px-4 py-2 disabled:opacity-50" disabled={busy}>
          {busy ? "Importing…" : "Start Import"}
        </button>
      </form>
      {msg && <div className="rounded-xl border p-3 text-sm">{msg}</div>}
      <p className="text-sm opacity-70">
        Tip: you can select multiple weeks at once; the importer will upsert events and replace all results for those
        tournaments.
      </p>
    </main>
  );
}
