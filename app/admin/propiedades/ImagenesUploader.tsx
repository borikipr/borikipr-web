"use client";

import { useRef, useState, useCallback } from "react";

type Props = {
  onUploaded: (urls: string[]) => void;
};

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/videos/");
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

type SelectedFile = {
  file: File;
  previewUrl: string;
  isVideo: boolean;
};

export default function ImagenesUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lastUploaded, setLastUploaded] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  const handleFileSelect = useCallback(() => {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;

    const newFiles: SelectedFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isVideo: isVideoFile(file),
    }));

    setSelectedFiles((prev) => [...prev, ...newFiles]);

    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleUpload = async () => {
    setError("");

    if (selectedFiles.length === 0) {
      setError("Selecciona al menos un archivo.");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((sf) => formData.append("files", sf.file));

    try {
      setUploading(true);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudieron subir los archivos.");
        return;
      }

      const urls = Array.isArray(data.urls) ? data.urls : [];
      onUploaded(urls);
      setLastUploaded(urls);

      // Cleanup previews and clear selection
      selectedFiles.forEach((sf) => URL.revokeObjectURL(sf.previewUrl));
      setSelectedFiles([]);
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error subiendo los archivos.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
        Subir imágenes y videos
      </p>

      <p className="mt-2 text-xs text-[#4d4d4d]">
        Imágenes: JPG, PNG, WebP (máx. 10MB) · Videos: MP4, WebM (máx. 50MB,
        recomendado 30-60 seg)
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <label className="btn-secondary cursor-pointer px-5 py-2.5 text-sm">
            Seleccionar archivos
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="btn-primary disabled:opacity-60"
          >
            {uploading
              ? "Subiendo..."
              : `Subir ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Preview de archivos seleccionados (antes de subir) */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#000000]">
              Archivos seleccionados ({selectedFiles.length}):
            </p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {selectedFiles.map((sf, index) => (
                <div
                  key={`${sf.file.name}-${index}`}
                  className="group/card relative overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white"
                >
                  {/* Botón eliminar */}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
                    title="Quitar archivo"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {sf.isVideo ? (
                    <div className="relative h-40 w-full bg-black">
                      <video
                        src={sf.previewUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
                          <svg
                            className="h-5 w-5 text-[#11518b] ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 rounded-full bg-[#11518b] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Video
                      </span>
                    </div>
                  ) : (
                    <img
                      src={sf.previewUrl}
                      alt={sf.file.name}
                      className="h-40 w-full object-cover"
                    />
                  )}

                  <div className="p-3">
                    <p className="truncate text-xs font-medium text-[#4d4d4d]">
                      {sf.file.name}
                    </p>
                    <p className="text-[10px] text-[#999]">
                      {(sf.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Archivos subidos exitosamente */}
        {lastUploaded.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#000000]">
              Archivos subidos correctamente:
            </p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lastUploaded.map((url) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white"
                >
                  {isVideoUrl(url) ? (
                    <div className="relative h-40 w-full bg-black">
                      <video
                        src={url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80">
                          <svg
                            className="h-6 w-6 text-[#11518b] ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 rounded-full bg-[#11518b] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Video
                      </span>
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt="Imagen subida"
                      className="h-40 w-full object-cover"
                    />
                  )}
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
