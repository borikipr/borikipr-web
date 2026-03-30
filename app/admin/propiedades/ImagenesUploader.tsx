"use client";

import { useRef, useState } from "react";

type Props = {
  onUploaded: (urls: string[]) => void;
};

export default function ImagenesUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lastUploaded, setLastUploaded] = useState<string[]>([]);

  const handleUpload = async () => {
    setError("");

    const files = inputRef.current?.files;
    if (!files || files.length === 0) {
      setError("Selecciona al menos una imagen.");
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      setUploading(true);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudieron subir las imágenes.");
        return;
      }

      const urls = Array.isArray(data.urls) ? data.urls : [];
      onUploaded(urls);
      setLastUploaded(urls);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error subiendo las imágenes.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
        Subir imágenes
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="block w-full rounded-2xl border border-[#d9d9d9] bg-white px-4 py-3 text-sm text-[#4d4d4d]"
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary disabled:opacity-60"
          >
            {uploading ? "Subiendo..." : "Subir imágenes"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {lastUploaded.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#000000]">
              Imágenes subidas correctamente:
            </p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lastUploaded.map((url) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white"
                >
                  <img
                    src={url}
                    alt="Imagen subida"
                    className="h-40 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="break-all text-xs text-[#4d4d4d]">{url}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}