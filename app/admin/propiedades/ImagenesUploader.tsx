"use client";

import MediaDropZone from "@/components/admin/MediaDropZone";

export default function ImagenesUploader({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  return <MediaDropZone purpose="property" multiple title="Imágenes y videos de la propiedad" instructions="JPG, PNG o WebP hasta 10 MB; MP4, WebM o MOV hasta 50 MB. Máximo 10 archivos por carga." accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" onUploaded={onUploaded} />;
}
