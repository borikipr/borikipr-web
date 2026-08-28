import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import {
  BROKER_SETTINGS_CONFIRMATION,
  createSignatureProductRepository,
} from "@/lib/signatures/productization";
import { BrokerSettingsControl } from "./BrokerSettingsControl";

export default async function SignatureSettingsPage() {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const data = await createSignatureProductRepository(
    createPostgresSignatureDatabase(sql),
  ).settings();
  const configured = Boolean(data.settings?.broker_admin_user_id);

  return (
    <AdminPageShell>
      <AdminPageHeader
        actions={
          <Link className="btn-secondary" href="/admin/signatures/gobernanza">
            Estado y soporte
          </Link>
        }
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/signatures", label: "Firmas" },
          { label: "Configuración" },
        ]}
        description="Define quién firma al final cuando un documento requiere corredora."
        eyebrow="Firmas"
        title="Configuración"
      />

      <section className="surface-card max-w-3xl p-5" id="corredora">
        <h2 className="text-lg font-semibold">Corredora final</h2>
        <p className="mt-1 text-sm text-slate-600">
          Si un documento requiere firma de corredora, Borikí resuelve esta
          cuenta automáticamente y la coloca al final de la ruta.
        </p>

        {configured ? (
          <>
            <dl className="admin-meta-grid mt-4 max-w-xl">
              <div>
                <dt>Cuenta configurada</dt>
                <dd>{data.settings?.broker_name_snapshot}</dd>
              </div>
              <div>
                <dt>Regla</dt>
                <dd>Firma final automática</dd>
              </div>
            </dl>
            <BrokerSettingsControl
              admins={data.admins}
              brokerAdminUserId={data.settings?.broker_admin_user_id ?? ""}
              confirmationPhrase={BROKER_SETTINGS_CONFIRMATION}
            />
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">Configura una corredora final.</p>
            <p className="mt-1 text-sm">
              Es necesaria antes de preparar documentos que requieran su
              firma.
            </p>
            <div className="mt-4">
              <BrokerSettingsControl
                admins={data.admins}
                brokerAdminUserId=""
                confirmationPhrase={BROKER_SETTINGS_CONFIRMATION}
                initialSetup
              />
            </div>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
