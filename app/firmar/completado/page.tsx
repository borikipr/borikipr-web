import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";

export default async function SigningCompletedPage({
  searchParams,
}: {
  searchParams: Promise<{ document?: string }>;
}) {
  if (!isSignerRuntimeEnabled()) notFound();
  const finalDocument = (await searchParams).document === "completed";
  return (
    <section className="signature-completion-page">
      <div className="signature-completion-card">
        <div aria-hidden="true" className="signature-completion-check">
          ✓
        </div>
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#11518b]">
          Borikí Sign
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Firma completada</h1>
        <p className="mt-4 text-lg leading-7 text-slate-700">
          {finalDocument
            ? "El documento ha sido completado."
            : "Tu participación fue completada correctamente. El documento continuará con los demás firmantes."}
        </p>
        <p className="mt-3 text-sm text-slate-600">
          No tienes que realizar ninguna otra acción. Tu sesión privada fue
          cerrada.
        </p>
        <time
          className="mt-6 block border-t border-slate-200 pt-4 text-xs text-slate-500"
          dateTime={new Date().toISOString()}
          suppressHydrationWarning
        >
          {new Date().toLocaleString("es-PR", {
            timeZone: "America/Puerto_Rico",
          })}{" "}
          · Hora de Puerto Rico
        </time>
      </div>
    </section>
  );
}
