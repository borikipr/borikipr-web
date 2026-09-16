"use client";

import { useMemo, useState } from "react";
import type {
  PropertyPerformanceDisplayRow,
  PropertyPerformanceResult,
  PropertyPerformanceUnavailableSection,
} from "@/lib/admin/analytics/property-performance";
import { totalSuccessfulForms } from "@/lib/admin/analytics/property-performance";

type SortKey =
  | "title"
  | "views"
  | "shares"
  | "whatsappClicks"
  | "contactClicks"
  | "forms"
  | "contactActionRate";

function formatNumber(value: number) {
  return value.toLocaleString("es-PR");
}

function formatRate(value: number | null) {
  if (value === null) return "—";
  return `${(value * 100).toLocaleString("es-PR", {
    maximumFractionDigits: 1,
  })}%`;
}

function statusLabel(status: string | null) {
  if (!status) return null;
  return status.replaceAll("_", " ");
}

function PrimaryMetrics({ row }: { row: PropertyPerformanceDisplayRow }) {
  const metrics = [
    ["Vistas", row.views],
    ["Shares", row.shares],
    ["WhatsApp", row.whatsappClicks],
    ["Formularios", totalSuccessfulForms(row)],
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-2">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-[#f7f9fb] px-3 py-2">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#4d4d4d]">
            {label}
          </dt>
          <dd className="mt-1 text-lg font-bold text-[#111827]">
            {formatNumber(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PropertyPerformanceSection({
  result,
  rows,
}: {
  result: PropertyPerformanceResult;
  rows: PropertyPerformanceDisplayRow[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [selectedSlug, setSelectedSlug] = useState(rows[0]?.propertySlug ?? "");

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    return copy.sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title, "es");
      if (sortKey === "forms") {
        return totalSuccessfulForms(b) - totalSuccessfulForms(a);
      }
      const aValue = a[sortKey] ?? -1;
      const bValue = b[sortKey] ?? -1;
      return Number(bValue) - Number(aValue) || a.title.localeCompare(b.title, "es");
    });
  }, [rows, sortKey]);

  const selected =
    rows.find((row) => row.propertySlug === selectedSlug) ?? rows[0] ?? null;
  const unavailableSections: PropertyPerformanceUnavailableSection[] = [
    ...result.unavailableSections,
  ].filter((section): section is PropertyPerformanceUnavailableSection => section !== "core");

  const sortButton = (label: string, key: SortKey) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      aria-pressed={sortKey === key}
      className="text-left font-semibold text-[#11518b] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
    >
      {label}
    </button>
  );

  return (
    <section className="surface-card p-5 md:p-6" aria-labelledby="property-performance-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Interés digital</p>
          <h2 id="property-performance-title" className="mt-2 text-2xl font-semibold text-[#111827]">
            Rendimiento por propiedad
          </h2>
          <p className="body-base mt-2 max-w-3xl">
            Vistas, acciones de compartir, contactos y formularios agregados por listado.
          </p>
        </div>
        <p className="text-sm font-semibold text-[#4d4d4d]">
          Datos agregados · sin información personal
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-[#eadca5] bg-[#fffaf0] px-4 py-3 text-sm leading-relaxed text-[#4d4d4d]">
        Sin historial completo de shares: las métricas de compartir incluyen únicamente la actividad registrada desde que el Share Kit esté activo en producción. Los shares y las visitas desde enlaces compartidos son métricas distintas.
      </div>

      {result.status === "unavailable" ? (
        <div className="mt-5 rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-5">
          <p className="font-semibold text-[#111827]">No disponible</p>
          <p className="mt-2 text-sm text-[#4d4d4d]">{result.reason}</p>
        </div>
      ) : (
        <>
          {result.status === "partial" ? (
            <div className="mt-5 rounded-2xl border border-[#eadca5] bg-[#fffaf0] p-4 text-sm text-[#4d4d4d]">
              <strong className="text-[#111827]">Datos parciales.</strong> {result.reason}
            </div>
          ) : null}

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-[#e5e7eb] md:block">
            <table className="min-w-[940px] w-full border-collapse text-sm">
              <thead className="bg-[#f7f9fb] text-[#4d4d4d]">
                <tr>
                  <th className="px-4 py-3 text-left">{sortButton("Propiedad", "title")}</th>
                  <th className="px-3 py-3 text-right">{sortButton("Vistas", "views")}</th>
                  <th className="px-3 py-3 text-right">{sortButton("Shares", "shares")}</th>
                  <th className="px-3 py-3 text-right">{sortButton("WhatsApp", "whatsappClicks")}</th>
                  <th className="px-3 py-3 text-right">{sortButton("Contactar", "contactClicks")}</th>
                  <th className="px-3 py-3 text-right">{sortButton("Formularios", "forms")}</th>
                  <th className="px-4 py-3 text-right">{sortButton("Tasa de contacto", "contactActionRate")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.propertySlug} className="border-t border-[#e5e7eb] align-middle">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSlug(row.propertySlug)}
                        aria-pressed={selected?.propertySlug === row.propertySlug}
                        className="max-w-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
                      >
                        <span className="block font-semibold text-[#11518b] hover:underline">{row.title}</span>
                        <span className="mt-1 block text-xs text-[#4d4d4d]">
                          {row.historical
                            ? "Histórico / ya no coincide con inventario actual"
                            : [row.municipality, statusLabel(row.status)].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{formatNumber(row.views)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.shares)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.whatsappClicks)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(row.contactClicks)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(totalSuccessfulForms(row))}</td>
                    <td className="px-4 py-3 text-right">{formatRate(row.contactActionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-3 md:hidden">
            {sortedRows.map((row) => (
              <article key={row.propertySlug} className="rounded-2xl border border-[#e5e7eb] p-4">
                <h3 className="font-semibold text-[#111827]">{row.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#4d4d4d]">
                  {row.historical
                    ? "Histórico / ya no coincide con inventario actual"
                    : [row.municipality, statusLabel(row.status)].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-3"><PrimaryMetrics row={row} /></div>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(row.propertySlug)}
                  aria-pressed={selected?.propertySlug === row.propertySlug}
                  className="mt-3 min-h-11 rounded-full border border-[#11518b]/25 px-4 py-2 text-sm font-semibold text-[#11518b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11518b]"
                >
                  Ver desglose
                </button>
              </article>
            ))}
          </div>

          {selected ? (
            <div className="mt-5 rounded-2xl border border-[#d9e5ef] bg-[#f7fafc] p-5" aria-live="polite">
              <p className="eyebrow">Desglose seleccionado</p>
              <h3 className="mt-2 text-xl font-semibold text-[#111827]">{selected.title}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-white p-4 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4d4d4d]">Shares por canal</p>
                  {unavailableSections.includes("share_breakdown") ? (
                    <p className="mt-3 font-semibold text-[#4d4d4d]">No disponible</p>
                  ) : (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div><dt>WhatsApp</dt><dd className="font-bold">{formatNumber(selected.shareChannels.whatsapp)}</dd></div>
                      <div><dt>Facebook</dt><dd className="font-bold">{formatNumber(selected.shareChannels.facebook)}</dd></div>
                      <div><dt>Copy</dt><dd className="font-bold">{formatNumber(selected.shareChannels.copy)}</dd></div>
                      <div><dt>QR</dt><dd className="font-bold">{formatNumber(selected.shareChannels.qr)}</dd></div>
                    </dl>
                  )}
                </div>
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4d4d4d]">Visitas desde enlaces compartidos</p>
                  <p className="mt-3 text-2xl font-bold text-[#111827]">
                    {unavailableSections.includes("shared_link_arrivals")
                      ? "No disponible"
                      : formatNumber(selected.sharedLinkArrivals)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4d4d4d]">Tasa de formularios</p>
                  <p className="mt-3 text-2xl font-bold text-[#111827]">{formatRate(selected.formRate)}</p>
                  <p className="mt-1 text-xs text-[#4d4d4d]">Acciones por vista; no representa usuarios únicos.</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-[#e5e7eb] p-5 text-sm text-[#4d4d4d]">
              No hay propiedades ni actividad para este periodo.
            </p>
          )}
        </>
      )}
    </section>
  );
}
