import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { inspectProductionPublicLaunchGate } from "@/lib/signatures/public-launch";
import { requireModulePageAccess } from "@/lib/admin/page-access";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function SignatureAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModulePageAccess("signatures");
  // This remains a fail-closed, canonical request-time check. A healthy
  // foundation is intentionally quiet; only a real public-launch blocker is
  // surfaced in the everyday signing workspace.
  await connection();
  let publicLaunchAllowed = false;
  try {
    publicLaunchAllowed = (
      await inspectProductionPublicLaunchGate(
        createPostgresSignatureDatabase(sql),
      )
    ).allowed;
  } catch {
    publicLaunchAllowed = false;
  }

  return (
    <div className="min-w-0">
      {!publicLaunchAllowed ? (
        <aside
          aria-label="Aviso operativo de Firmas"
          className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-[1416px] flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:w-[calc(100%-3rem)]"
          role="alert"
        >
          <div>
            <strong>Firmas requiere atención.</strong>{" "}
            La activación pública necesita una revisión antes de operar.
          </div>
          <Link className="btn-secondary shrink-0" href="/admin/signatures/gobernanza">
            Ver estado
          </Link>
        </aside>
      ) : null}
      {children}
    </div>
  );
}
