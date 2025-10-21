"use client";

import { useRef, useState } from "react";

type ApiResult = any;

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const onSelect: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // If your API supports a specific sheet name you can add it:
      // fd.append("sheet", "Sheet1");

      const res = await fetch("/api/admin/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json?._error || `Import failed (${res.status})`);
      } else {
        setResult(json);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  };

  const pretty = (obj: any) => JSON.stringify(obj, null, 2);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin — Import Weekly Excel</h1>
        <a href="/admin/seasons" className="text-sm underline">Seasons</a>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: picker */}
        <div className="md:col-span-1 space-y-4">
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              uploading ? "opacity-60" : ""
            }`}
          >
            <p className="mb-2 text-sm text-gray-600">Drag & drop the Excel file here</p>
            <p className="text-xs text-gray-500">…or choose a file below</p>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={onSelect}
              disabled={uploading}
              className="block w-full"
            />
            {file && (
              <p className="text-xs text-gray-600">
                Selected: <b>{file.name}</b> ({Math.round(file.size / 1024)} KB)
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="border rounded px-3 py-1"
                onClick={startUpload}
                disabled={!file || uploading}
                title={!file ? "Choose a file first" : "Start import"}
              >
                {uploading ? "Uploading…" : "Import"}
              </button>
              <button
                className="border rounded px-3 py-1"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
                disabled={uploading}
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Tip: This uses your existing <code>/api/admin/import</code> route.
              It will diff against existing rows and return counts + details.
            </p>
          </div>
        </div>

        {/* Right: results */}
        <div className="md:col-span-2 space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}
          {uploading && (
            <div className="p-3 rounded bg-blue-50 text-blue-700 text-sm">
              Processing… large files can take a bit.
            </div>
          )}

          {!uploading && result && (
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b bg-gray-50 text-sm font-medium">Import Result (raw)</div>
                <pre className="p-4 overflow-x-auto text-xs">
                  {pretty(result)}
                </pre>
              </div>

              {/* Try to display common fields if present */}
              <div className="grid md:grid-cols-2 gap-4">
                {"inserted" in result && (
                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium mb-1">Inserted</div>
                    <div className="text-2xl font-semibold">
                      {Array.isArray(result.inserted) ? result.inserted.length : Number(result.inserted ?? 0)}
                    </div>
                  </div>
                )}
                {"updated" in result && (
                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium mb-1">Updated</div>
                    <div className="text-2xl font-semibold">
                      {Array.isArray(result.updated) ? result.updated.length : Number(result.updated ?? 0)}
                    </div>
                  </div>
                )}
                {"skipped" in result && (
                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium mb-1">Skipped</div>
                    <div className="text-2xl font-semibold">
                      {Array.isArray(result.skipped) ? result.skipped.length : Number(result.skipped ?? 0)}
                    </div>
                  </div>
                )}
                {"errors" in result && (
                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium mb-1">Errors</div>
                    <div className="text-2xl font-semibold">
                      {Array.isArray(result.errors) ? result.errors.length : Number(result.errors ?? 0)}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500">
                If you want a more specific summary (e.g., per-table counts), we can tweak the API to return a compact stats object for this screen.
              </div>
            </div>
          )}

          {!uploading && !result && !error && (
            <div className="text-sm text-gray-600">
              Drop your weekly Excel file to begin. The site will rebuild leaderboards based on the new/changed rows.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
