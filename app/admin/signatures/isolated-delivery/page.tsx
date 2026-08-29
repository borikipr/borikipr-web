import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/access-context";
import { IsolatedDeliveryControl } from "./IsolatedDeliveryControl";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrega sintética aislada",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function IsolatedDeliveryPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.SIGNING_ISOLATED_ENVIRONMENT !== "true" ||
    process.env.SIGNING_ISOLATED_EMAIL_SINK !== "memory" ||
    !(await requireSuperAdmin().then(() => true).catch(() => false))
  ) {
    notFound();
  }

  return (
    <main>
      <p>TEST / NON-PRODUCTION</p>
      <h1>Entrega de firma aislada</h1>
      <p>Esta superficie existe únicamente para el adaptador de correo sintético en memoria.</p>
      <IsolatedDeliveryControl />
    </main>
  );
}
