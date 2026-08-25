"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function SignerDocumentViewer({
  pageCount,
}: {
  pageCount: number;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    function goToFieldPage(event: Event) {
      const requested = Number(
        (event as CustomEvent<{ pageIndex?: number }>).detail?.pageIndex,
      );
      if (
        Number.isInteger(requested) &&
        requested >= 0 &&
        requested < pageCount
      )
        setPageIndex(requested);
    }
    window.addEventListener("boriki:signer-page", goToFieldPage);
    return () =>
      window.removeEventListener("boriki:signer-page", goToFieldPage);
  }, [pageCount]);

  return (
    <section
      className="signer-document-viewer"
      aria-label="Visor del documento"
    >
      <div className="signer-document-toolbar">
        <div className="flex items-center gap-2">
          <button
            className="min-h-11 rounded-lg border bg-white px-3 py-2 font-medium disabled:opacity-50"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((value) => value - 1)}
            type="button"
          >
            Anterior
          </button>
          <label className="text-sm font-medium">
            Página
            <select
              className="ml-2 min-h-11 rounded-lg border bg-white px-2 py-2"
              value={pageIndex}
              onChange={(event) => setPageIndex(Number(event.target.value))}
            >
              {Array.from({ length: pageCount }, (_, index) => (
                <option key={index} value={index}>
                  {index + 1} / {pageCount}
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-11 rounded-lg border bg-white px-3 py-2 font-medium disabled:opacity-50"
            disabled={pageIndex + 1 >= pageCount}
            onClick={() => setPageIndex((value) => value + 1)}
            type="button"
          >
            Siguiente
          </button>
        </div>
        <label className="text-sm font-medium">
          Zoom
          <select
            className="ml-2 min-h-11 rounded-lg border bg-white px-2 py-2"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </label>
      </div>
      <div className="signer-document-scroll">
        <div
          className="mx-auto origin-top"
          style={{ width: `${zoom * 100}%`, maxWidth: `${zoom * 900}px` }}
        >
          <Image
            unoptimized
            loading="eager"
            width={1200}
            height={1600}
            src={`/firmar/sesion/pages/${pageIndex}`}
            alt={`Página ${pageIndex + 1} del documento`}
            className="h-auto w-full bg-white shadow-xl"
          />
        </div>
      </div>
    </section>
  );
}
