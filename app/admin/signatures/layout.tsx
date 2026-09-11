import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { inspectProductionPublicLaunchGate } from "@/lib/signatures/public-launch";
import { requireModulePageAccess } from "@/lib/admin/page-access";
import SignatureOperationalAlert from "@/components/admin/signatures/SignatureOperationalAlert";

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
      {!publicLaunchAllowed ? <SignatureOperationalAlert /> : null}
      {children}
    </div>
  );
}
