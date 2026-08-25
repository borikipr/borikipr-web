"use client";

import MediaDropZone from "@/components/admin/MediaDropZone";

export default function ImagenesUploader({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  return <MediaDropZone purpose="testimonial" multiple={false} title="Foto del testimonio" instructions="JPG, PNG o WebP hasta 5 MB. Puedes reemplazarla o quitarla antes de guardar." accept="image/png,image/jpeg,image/webp" onUploaded={onUploaded} />;
}
