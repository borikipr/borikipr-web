"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STATUS_PATH = "/admin/signatures/gobernanza";

export default function SignatureOperationalAlert() {
  const pathname = usePathname();

  if (pathname === STATUS_PATH) return null;

  return (
    <aside
      aria-label="Aviso operativo de Firmas"
      className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-[1416px] flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:w-[calc(100%-3rem)]"
      role="alert"
    >
      <div>
        <strong>Firmas requiere atención.</strong>{" "}
        La activación pública necesita una revisión antes de operar.
      </div>
      <Link className="btn-secondary shrink-0" href={STATUS_PATH}>
        Ver estado
      </Link>
    </aside>
  );
}
