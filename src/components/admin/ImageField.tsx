"use client";

import { useRef, useState } from "react";

/**
 * Image picker for forms: uploads to the media bucket and submits the URL as `name`.
 * `placeholder` is the image shown when nothing is set (the site's default); "Remove" then means
 * "go back to the default" once the form is saved.
 */
export default function ImageField({ defaultValue, name = "image_url", folder = "news", label = "Image", placeholder, wide = false }: {
  defaultValue: string;
  name?: string;
  folder?: "news" | "badges" | "logos" | "photos";
  label?: string;
  placeholder?: string;
  wide?: boolean;
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

  const shown = url || placeholder || "";
  const frame = folder === "logos"
    ? "h-20 w-72 bg-base-300 object-contain p-3" // whole logo, on the site's dark background
    : wide
      ? "aspect-[3/1] w-full max-w-[28rem] object-cover"
      : "h-24 w-40 object-cover";

  return (
    <div className="form-control">
      <span className="label-text mb-1.5 text-[0.875rem] font-medium text-season-ink/85">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className={`flex gap-3 ${wide ? "flex-col" : "flex-col sm:flex-row sm:items-center"}`}>
        {shown ? (
          <span className="relative block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="" className={`${frame} rounded-[3px] ring-1 ring-base-content/10 ${url ? "" : "opacity-60"}`} />
            {!url && placeholder && <span className="absolute left-2 top-2 rounded-[3px] bg-season-night/85 px-2 py-0.5 text-[0.8125rem] text-season-ink/85">Default</span>}
          </span>
        ) : (
          <div className="flex h-24 w-40 items-center justify-center rounded-[3px] bg-base-200 text-[0.875rem] text-season-muted">No image</div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : url ? "Replace image" : "Upload image"}
          </button>
          {url && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUrl("")}>
              {placeholder ? "Back to default" : "Remove"}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      {error && <span role="alert" className="mt-1 text-[0.875rem] text-error">{error}</span>}
      {url !== defaultValue && <span className="mt-1 text-[0.875rem] text-season-amber">Not saved yet: press Save.</span>}
    </div>
  );
}
