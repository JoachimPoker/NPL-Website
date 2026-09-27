"use client";

import { useRef, useState } from "react";

/** Image picker for forms: uploads to the media bucket and submits the URL as `name`. */
export default function ImageField({ defaultValue, name = "image_url", folder = "news", label = "Image" }: {
  defaultValue: string;
  name?: string;
  folder?: "news" | "badges" | "logos";
  label?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setUrl(json.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-control">
      <span className="label-text mb-1 text-xs font-bold">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className={
              folder === "logos"
                ? "h-20 w-72 rounded-lg bg-base-300 object-contain p-3 ring-1 ring-base-content/10" // whole logo, on the site's dark background
                : "h-24 w-40 rounded-lg object-cover ring-1 ring-base-content/10"
            }
          />
        ) : (
          <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-base-200 text-xs opacity-50">No image</div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : url ? "Replace image" : "Upload image"}
          </button>
          {url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUrl("")}>Remove</button>}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      {error && <span className="mt-1 text-xs text-error">{error}</span>}
    </div>
  );
}
