"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";

type Props = {
  onUploaded: (urls: string[]) => void;
};

type SelectedFile = {
  file: File;
  previewUrl: string;
};

export default function ImagenesUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [lastUploaded, setLastUploaded] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const handleFileSelect = useCallback(() => {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Cleanup previous preview if exists
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }

    const newFile: SelectedFile = {
      file,
      previewUrl: URL.createObjectURL(file),
    };

    setSelectedFile(newFile);

    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [selectedFile]);

  const removeFile = useCallback(() => {
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.previewUrl);
      setSelectedFile(null);
    }
  }, [selectedFile]);

  const handleUpload = async () => {
    setError("");

    if (!selectedFile) {
      setError("Selecciona una imagen.");
      return;
    }

    const formData = new FormData();
    formData.append("files", selectedFile.file);

    try {
      setUploading(true);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo subir la imagen.");
        return;
      }

      const urls = Array.isArray(data.urls) ? data.urls : [];
      onUploaded(urls);
      setLastUploaded(urls);

      // Cleanup preview and clear selection
      URL.revokeObjectURL(selectedFile.previewUrl);
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error subiendo la imagen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
        Subir foto del cliente
      </p>

      <p className="mt-2 text-xs text-[#4d4d4d]">
        Formatos: JPG, PNG, WebP (máx. 5MB) · Solo una imagen por testimonio.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <label className="btn-secondary cursor-pointer px-5 py-2.5 text-sm">
            Seleccionar foto
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="btn-primary disabled:opacity-60"
          >
            {uploading ? "Subiendo..." : "Subir foto"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Preview del archivo seleccionado (antes de subir) */}
        {selectedFile && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#000000]">
              Foto seleccionada:
            </p>

            <div className="max-w-xs">
              <div className="group/card relative overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
                {/* Botón eliminar */}
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
                  title="Quitar foto"
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

                <div className="relative h-40 w-full">
                  <Image
                    src={selectedFile.previewUrl}
                    alt={selectedFile.file.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-cover"
                  />
                </div>

                <div className="p-3">
                  <p className="truncate text-xs font-medium text-[#4d4d4d]">
                    {selectedFile.file.name}
                  </p>
                  <p className="text-[10px] text-[#999]">
                    {(selectedFile.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archivo subido exitosamente */}
        {lastUploaded.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#000000]">
              Foto subida correctamente:
            </p>

            <div className="max-w-xs">
              <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
                <div className="relative h-40 w-full">
                  <Image
                    src={lastUploaded[0]}
                    alt="Foto subida"
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="break-all text-xs text-[#4d4d4d]">{lastUploaded[0]}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
