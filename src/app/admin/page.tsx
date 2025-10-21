"use client";

import { useState } from "react";

export default function AdminHome() {
  const [ok, setOk] = useState(false);
  const [pwd, setPwd] = useState("");

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pwd }),
    });
    if (res.ok) setOk(true);
    else alert("Wrong password");
  }

  if (!ok) {
    return (
      <div className="max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Admin sign-in</h1>
        <form onSubmit={check} className="space-y-2">
          <input
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="Admin password"
            className="w-full border rounded px-3 py-2"
          />
          <button className="border rounded px-3 py-2">Enter</button>
        </form>
        <p className="text-xs text-gray-600">Temporary gate; we’ll switch to Supabase Auth later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <ul className="list-disc pl-6">
        <li><a className="underline" href="/admin/import">Import weekly Excel</a></li>
        <li><a className="underline" href="/admin/seasons">Seasons</a></li>
        <li><a className="underline" href="/admin/series">Series & Festivals</a></li>
        <li className="opacity-60">Leaderboards/Players/Events admin (later)</li>
      </ul>
    </div>
  );
}
