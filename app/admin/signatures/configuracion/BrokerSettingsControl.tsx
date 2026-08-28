"use client";

import { useState } from "react";
import { SignatureActionDialog } from "@/components/admin/signatures/SignatureActionsMenu";
import { saveBrokerSettingsAction } from "./actions";

type Admin = { id: string; name: string; email: string | null };

export function BrokerSettingsControl({
  admins,
  brokerAdminUserId,
  confirmationPhrase,
  initialSetup = false,
}: {
  admins: readonly Admin[];
  brokerAdminUserId: string;
  confirmationPhrase: string;
  initialSetup?: boolean;
}) {
  const [open, setOpen] = useState(initialSetup);

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      {!initialSetup ? (
        <button className="btn-secondary" onClick={() => setOpen(true)} type="button">
          Cambiar corredora
        </button>
      ) : null}
      <SignatureActionDialog
        description="Los documentos nuevos que requieran firma de corredora usarán esta cuenta como firmante final."
        onClose={() => setOpen(false)}
        open={open}
        title={initialSetup ? "Configurar corredora final" : "Cambiar corredora final"}
      >
        <form action={saveBrokerSettingsAction} className="grid gap-4">
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
            Escribe <code>{confirmationPhrase}</code>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
              name="confirmationPhrase"
              required
            />
          </label>
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-secondary" onClick={() => setOpen(false)} type="button">
              Cancelar
            </button>
            <button className="btn-primary" type="submit">
              Guardar corredora final
            </button>
          </div>
        </form>
      </SignatureActionDialog>
    </div>
  );
}
