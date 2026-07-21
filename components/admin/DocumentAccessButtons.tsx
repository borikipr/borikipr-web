"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";

export function DocumentAccessButtons({
  downloadHref,
  previewHref,
}: {
  downloadHref: string;
  previewHref: string | null;
}) {
  const [opening, setOpening] = useState<"preview" | "download" | null>(null);

  function openDocument(kind: "preview" | "download", href: string) {
    if (opening) return;
    setOpening(kind);
    window.open(href, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setOpening(null), 1500);
  }

  return (
    <div className="flex flex-wrap gap-2" aria-live="polite">
      {previewHref && (
        <button
          aria-busy={opening === "preview"}
          className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
          disabled={opening !== null}
          onClick={() => openDocument("preview", previewHref)}
          type="button"
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
          {opening === "preview" ? "Abriendo…" : "Vista previa"}
        </button>
      )}
      <button
        aria-busy={opening === "download"}
        className="btn-secondary inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
        disabled={opening !== null}
        onClick={() => openDocument("download", downloadHref)}
        type="button"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        {opening === "download" ? "Preparando…" : "Descargar"}
      </button>
    </div>
  );
}
