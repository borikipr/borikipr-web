"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, ImageIcon, Star, Trash2, Video } from "lucide-react";
import { AdminActionsMenu, AdminMenuItem } from "@/components/admin/AdminActionsMenu";

type Props = { items: string[]; onChange: (items: string[]) => void };

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/videos/");
}

export default function PropertyMediaManager({ items, onChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  if (!items.length) {
    return (
      <section className="property-media-empty" aria-label="Multimedia de la propiedad">
        <ImageIcon aria-hidden="true" size={22} />
        <div><strong>Sin archivos añadidos</strong><p>Sube imágenes o videos para preparar la galería pública.</p></div>
      </section>
    );
  }

  return (
    <section className="property-media-manager" aria-labelledby="property-media-order-title">
      <header>
        <div>
          <p className="eyebrow">Galería pública</p>
          <h3 id="property-media-order-title">Orden y portada</h3>
          <p>Arrastra para ordenar. La primera imagen se usa como portada.</p>
        </div>
        <span>{items.length} {items.length === 1 ? "archivo" : "archivos"}</span>
      </header>
      <div className="property-media-grid">
        {items.map((url, index) => {
          const video = isVideo(url);
          return (
            <article
              key={`${url}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={dragIndex === index ? "is-dragging" : ""}
            >
              <div className="property-media-preview">
                {video ? (
                  <video src={url} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <Image src={url} alt={`Imagen ${index + 1} de la propiedad${index === 0 ? ", portada" : ""}`} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                )}
                <span className="property-media-type" aria-label={video ? "Video" : "Imagen"}>
                  {video ? <Video aria-hidden="true" size={15} /> : <ImageIcon aria-hidden="true" size={15} />}
                </span>
                {index === 0 && <span className="property-cover-badge"><Star aria-hidden="true" size={12} fill="currentColor" /> Portada</span>}
                <button type="button" className="property-drag-handle" aria-label={`Arrastrar archivo ${index + 1}`} title="Arrastrar para ordenar">
                  <GripVertical aria-hidden="true" size={18} />
                </button>
              </div>
              <div className="property-media-footer">
                <span>Posición {index + 1}</span>
                <AdminActionsMenu compact label={`Acciones del archivo ${index + 1}`}>
                  {index > 0 && <AdminMenuItem icon={<Star size={16} />} onSelect={() => move(index, 0)}>Usar como portada</AdminMenuItem>}
                  {index > 0 && <AdminMenuItem icon={<ArrowLeft size={16} />} onSelect={() => move(index, index - 1)}>Mover imagen antes</AdminMenuItem>}
                  {index < items.length - 1 && <AdminMenuItem icon={<ArrowRight size={16} />} onSelect={() => move(index, index + 1)}>Mover imagen después</AdminMenuItem>}
                  <div className="admin-actions-separator" />
                  <AdminMenuItem danger icon={<Trash2 size={16} />} onSelect={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Quitar archivo</AdminMenuItem>
                </AdminActionsMenu>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
