"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type MediaPurpose = "property" | "testimonial";
type SelectedMedia = { id: string; file: File; previewUrl: string; status: "ready" | "uploading" | "error" };
type Props = { purpose: MediaPurpose; multiple: boolean; title: string; instructions: string; accept: string; onUploaded: (urls: string[]) => void };

function isVideo(file: File) { return file.type.startsWith("video/"); }

function validateFiles(files: File[], purpose: MediaPurpose) {
  const images = new Set(["image/jpeg", "image/png", "image/webp"]);
  const videos = new Set(["video/mp4", "video/webm", "video/quicktime"]);
  const maxFiles = purpose === "property" ? 10 : 1;
  if (files.length > maxFiles) return `Puedes seleccionar hasta ${maxFiles} archivos por carga.`;
  for (const file of files) {
    const video = videos.has(file.type);
    if (!images.has(file.type) && !(purpose === "property" && video)) return `${file.name}: formato no permitido.`;
    const maxBytes = (purpose === "testimonial" ? 5 : video ? 50 : 10) * 1024 * 1024;
    if (file.size > maxBytes) return `${file.name}: excede el tamaño permitido.`;
  }
  return "";
}

export default function MediaDropZone({ purpose, multiple, title, instructions, accept, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<SelectedMedia[]>([]);
  const [items, setItems] = useState<SelectedMedia[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);

  const selectFiles = useCallback((list: FileList | File[]) => {
    const files = Array.from(list);
    const next = multiple ? files : files.slice(0, 1);
    const validation = validateFiles(next, purpose);
    if (validation) { setMessage(validation); return; }
    setMessage("");
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return next.map((file, index) => ({ id: `${file.name}-${file.lastModified}-${index}`, file, previewUrl: URL.createObjectURL(file), status: "ready" }));
    });
  }, [multiple, purpose]);

  const remove = (id: string) => setItems((current) => {
    const removed = current.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    return current.filter((item) => item.id !== id);
  });

  const upload = async () => {
    if (!items.length || uploading) return;
    setUploading(true); setMessage("");
    setItems((current) => current.map((item) => ({ ...item, status: "uploading" })));
    const formData = new FormData();
    formData.set("purpose", purpose);
    items.forEach((item) => formData.append("files", item.file));
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await response.json() as { ok?: boolean; urls?: string[]; error?: string };
      if (!response.ok || !data.ok || !Array.isArray(data.urls)) throw new Error(data.error || "No se pudo completar la carga.");
      onUploaded(data.urls);
      setMessage(`${data.urls.length === 1 ? "Archivo añadido" : "Archivos añadidos"} correctamente.`);
      setItems((current) => { current.forEach((item) => URL.revokeObjectURL(item.previewUrl)); return []; });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la carga.");
      setItems((current) => current.map((item) => ({ ...item, status: "error" })));
    } finally { setUploading(false); }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby={`${purpose}-upload-title`}>
      <h2 id={`${purpose}-upload-title`} className="text-sm font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{instructions}</p>
      <div
        className={`mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-7 text-center transition ${dragging ? "border-[#d4af37] bg-[#fff9e6]" : "border-slate-300 bg-slate-50 hover:border-[#11518b]"}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}
        role="button" tabIndex={0} aria-label={multiple ? "Arrastra o selecciona imágenes y videos" : "Arrastra o selecciona una imagen"}
      >
        <span className="text-sm font-semibold text-[#11518b]">{multiple ? "Arrastra tus archivos aquí" : "Arrastra la imagen aquí"}</span>
        <span className="mt-1 text-sm text-slate-500">o selecciona desde tu dispositivo</span>
        <span className="btn-secondary pointer-events-none mt-4 px-4 py-2 text-sm">Seleccionar {multiple ? "archivos" : "archivo"}</span>
        <input ref={inputRef} className="sr-only" type="file" accept={accept} multiple={multiple} onChange={(event) => { if (event.target.files) selectFiles(event.target.files); event.currentTarget.value = ""; }} />
      </div>
      {items.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Archivos seleccionados">
        {items.map((item) => <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {isVideo(item.file) ? <video src={item.previewUrl} className="h-32 w-full bg-black object-cover" muted playsInline /> : <div className="relative h-32 w-full"><Image src={item.previewUrl} alt="" fill unoptimized className="object-cover" /></div>}
          <div className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.file.name}</p><p className="text-xs text-slate-500">{(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.status === "uploading" ? "Subiendo…" : item.status === "error" ? "Error" : "Listo"}</p></div><button type="button" className="text-sm font-semibold text-red-700" onClick={() => remove(item.id)} disabled={uploading}>Quitar</button></div>
        </article>)}
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className="btn-primary" onClick={upload} disabled={!items.length || uploading}>{uploading ? "Subiendo…" : `Añadir${items.length ? ` (${items.length})` : ""}`}</button>{message && <p className={`text-sm ${message.includes("correctamente") ? "text-emerald-700" : "text-red-700"}`} role="status">{message}</p>}</div>
    </section>
  );
}
