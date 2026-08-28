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
import { saveBrokerSettingsAction } from "./actions";

function BrokerSettingsForm({
  admins,
  brokerAdminUserId,
}: {
  admins: readonly { id: string; name: string; email: string | null }[];
  brokerAdminUserId: string;
}) {
  return (
    <form action={saveBrokerSettingsAction} className="grid max-w-xl gap-4">
      <label className="text-sm font-semibold">
        Cuenta Admin de la corredora
        <select
          className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
          defaultValue={brokerAdminUserId}
          name="brokerAdminUserId"
          required
        >
          <option value="">Selecciona</option>
          {admins
            .filter((admin) => admin.email)
            .map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Escribe <code>{BROKER_SETTINGS_CONFIRMATION}</code>
        <input
          className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
          name="confirmationPhrase"
          required
        />
      </label>
      <button className="btn-primary justify-self-start" type="submit">
        Guardar corredora final
      </button>
    </form>
  );
}

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
            <details className="mt-5 border-t border-slate-100 pt-4">
              <summary className="cursor-pointer font-semibold text-slate-800">
                Cambiar corredora final
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                Esta acción afecta los documentos nuevos que requieran su
                firma. Confirma el cambio antes de guardarlo.
              </p>
              <div className="mt-4">
                <BrokerSettingsForm
                  admins={data.admins}
                  brokerAdminUserId={data.settings?.broker_admin_user_id ?? ""}
                />
              </div>
            </details>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">Configura una corredora final.</p>
            <p className="mt-1 text-sm">
              Es necesaria antes de preparar documentos que requieran su
              firma.
            </p>
            <div className="mt-4">
              <BrokerSettingsForm admins={data.admins} brokerAdminUserId="" />
            </div>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
