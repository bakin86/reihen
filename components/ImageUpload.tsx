"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { type CenterImage, type ImageTag, IMAGE_TAGS } from "@/lib/image-types";

interface Props {
  images: CenterImage[];
  onChange: (images: CenterImage[]) => void;
  token: string;
  max?: number;
}

export function ImageUpload({ images, onChange, token, max = 8 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [activeTag, setActiveTag] = useState<ImageTag | "all">("all");

  const upload = async (files: FileList | File[]) => {
    setError("");
    const remaining = max - images.length;
    if (remaining <= 0) { setError(`Max ${max} images`); return; }

    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) return;

    setUploading(true);
    const form = new FormData();
    toUpload.forEach((f) => form.append("files", f));

    try {
      const csrf = document.cookie.match(/(?:^|;\s*)reihen_csrf=([^;]+)/)?.[1];
      const headers: Record<string, string> = {};
      if (token && token !== "cookie-auth") headers["Authorization"] = `Bearer ${token}`;
      if (csrf) headers["x-csrf-token"] = decodeURIComponent(csrf);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Determine tag: if no main exists yet, first upload becomes main
      const hasMain = images.some((img) => img.tag === "main");
      const newImages: CenterImage[] = (data.urls as string[]).map((url, i) => ({
        url,
        tag: (!hasMain && i === 0) ? "main" as ImageTag : "interior" as ImageTag,
      }));

      onChange([...images, ...newImages]);
    } catch (e: any) {
      setError(e.message);
    }
    setUploading(false);
  };

  const remove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const setTag = (idx: number, tag: ImageTag) => {
    const updated = images.map((img, i) => {
      if (i === idx) return { ...img, tag };
      // If setting as main, demote existing main
      if (tag === "main" && img.tag === "main") return { ...img, tag: "interior" as ImageTag };
      return img;
    });
    onChange(updated);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const arr = [...images];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange(arr);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  const filtered = activeTag === "all" ? images : images.filter((img) => img.tag === activeTag);

  return (
    <div>
      {/* Tag filter tabs */}
      {images.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag("all")}
            className={`px-2.5 py-1 text-[9px] uppercase tracking-widest transition-colors border ${
              activeTag === "all" ? "border-black bg-black text-white" : "border-gray text-gray hover:border-black"
            }`}
          >
            ALL ({images.length})
          </button>
          {IMAGE_TAGS.map((t) => {
            const count = images.filter((img) => img.tag === t.value).length;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTag(t.value)}
                className={`px-2.5 py-1 text-[9px] uppercase tracking-widest transition-colors border ${
                  activeTag === t.value ? "border-black bg-black text-white" : "border-gray text-gray hover:border-black"
                } ${count === 0 ? "opacity-30" : ""}`}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Preview grid */}
      {filtered.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2 md:grid-cols-6">
          {filtered.map((img, filteredIdx) => {
            const realIdx = images.indexOf(img);
            return (
              <div key={img.url + realIdx} className="group relative aspect-[4/3] overflow-hidden border border-black">
                <Image
                  src={img.url}
                  alt={`${img.tag} ${filteredIdx + 1}`}
                  fill
                  className="object-cover"
                  sizes="150px"
                />

                {/* Tag badge */}
                <span className={`absolute left-1 top-1 px-1.5 py-0.5 text-[8px] uppercase tracking-wider ${
                  img.tag === "main" ? "bg-black text-white" : "bg-white/90 text-black"
                }`}>
                  {img.tag === "main" ? "★ MAIN" : img.tag.toUpperCase()}
                </span>

                {/* Overlay controls */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Move + delete */}
                  <div className="flex items-center gap-1">
                    {realIdx > 0 && (
                      <button onClick={() => move(realIdx, realIdx - 1)}
                        className="flex h-6 w-6 items-center justify-center bg-white text-[10px] text-black">
                        &larr;
                      </button>
                    )}
                    <button onClick={() => remove(realIdx)}
                      className="flex h-6 w-6 items-center justify-center bg-white text-[10px] text-black">
                      x
                    </button>
                    {realIdx < images.length - 1 && (
                      <button onClick={() => move(realIdx, realIdx + 1)}
                        className="flex h-6 w-6 items-center justify-center bg-white text-[10px] text-black">
                        &rarr;
                      </button>
                    )}
                  </div>

                  {/* Tag selector */}
                  <select
                    value={img.tag}
                    onChange={(e) => setTag(realIdx, e.target.value as ImageTag)}
                    className="bg-white px-2 py-1 text-[9px] uppercase text-black outline-none"
                  >
                    {IMAGE_TAGS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone */}
      {images.length < max && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center border border-dashed py-8 transition-colors ${
            dragOver ? "border-black bg-black/5" : "border-gray hover:border-black"
          }`}
        >
          {uploading ? (
            <span className="text-xs uppercase tracking-[0.3em] text-gray">UPLOADING...</span>
          ) : (
            <>
              <span className="text-xs uppercase tracking-[0.3em] text-gray">
                DROP IMAGES OR CLICK TO UPLOAD
              </span>
              <span className="mono mt-2 text-[10px] text-gray">
                JPG, PNG, WebP · Max 5MB · {images.length}/{max}
              </span>
              <span className="mt-1 text-[9px] text-gray/60">
                First upload auto-tagged as MAIN
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }}
      />

      {error && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-red-600">{error}</p>
      )}
    </div>
  );
}
