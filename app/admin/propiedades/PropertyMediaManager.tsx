"use client";

import { useState } from "react";
import Image from "next/image";

type Props = { items: string[]; onChange: (items: string[]) => void };
function isVideo(url: string) { return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/videos/"); }

export default function PropertyMediaManager({ items, onChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next);
  };
  if (!items.length) return null;
  return <section className="space-y-3" aria-labelledby="property-media-order-title">
    <div><h3 id="property-media-order-title" className="text-sm font-semibold text-slate-950">Orden de imágenes</h3><p className="text-sm text-slate-600">La primera imagen es la portada pública. Arrastra en escritorio o usa los controles de orden.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((url, index) => <article key={`${url}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragEnd={() => setDragIndex(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }} className={`overflow-hidden rounded-xl border bg-white transition ${dragIndex === index ? "border-[#d4af37] opacity-60" : "border-slate-200"}`}>
      <div className="relative h-40 bg-slate-100">{isVideo(url) ? <video src={url} className="h-full w-full object-cover" muted playsInline /> : <Image src={url} alt={`Imagen ${index + 1} de la propiedad${index === 0 ? ", portada" : ""}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />}<span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-xs font-semibold ${index === 0 ? "bg-[#d4af37] text-slate-950" : "bg-slate-950/75 text-white"}`}>{index === 0 ? "Portada" : `Posición ${index + 1}`}</span><span className="absolute right-2 top-2 cursor-grab rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700" aria-hidden="true">Arrastrar</span></div>
      <div className="flex flex-wrap gap-2 p-3">{index > 0 && <button type="button" className="rounded-md border px-2 py-1 text-xs font-semibold" onClick={() => move(index, index - 1)} aria-label={`Mover imagen ${index + 1} antes`}>← Antes</button>}{index < items.length - 1 && <button type="button" className="rounded-md border px-2 py-1 text-xs font-semibold" onClick={() => move(index, index + 1)} aria-label={`Mover imagen ${index + 1} después`}>Después →</button>}{index > 0 && <button type="button" className="rounded-md border border-[#d4af37] px-2 py-1 text-xs font-semibold text-[#725b00]" onClick={() => move(index, 0)}>Usar como portada</button>}<button type="button" className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-red-700" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button></div>
    </article>)}</div>
  </section>;
}
