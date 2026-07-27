"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deletePropiedadAction,
  updatePropiedadEstadoAction,
  toggleDestacadoAction,
} from "./actions";

type EstadoPropiedad =
  | "disponible"
  | "coming_soon"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

type Props = {
  id: string;
  slug: string;
  estadoActual: EstadoPropiedad;
  destacadoActual: boolean;
};

export default function PropiedadRowActions({
  id,
  slug,
  estadoActual,
  destacadoActual,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [showPrivateLink, setShowPrivateLink] = useState(false);
  const [privateLink, setPrivateLink] = useState("");
  const [privateLinkError, setPrivateLinkError] = useState("");
  const [privateLinkPending, setPrivateLinkPending] = useState(false);

  const loadPrivateLink = async () => {
    setShowPrivateLink(true);
    if (privateLink) return;
    setPrivateLinkPending(true);
    setPrivateLinkError("");
    try {
      const response = await fetch(
        `/api/admin/propiedades/${id}/private-showing-link`,
        { cache: "no-store" }
      );
      const result = (await response.json()) as { ok?: boolean; url?: string };
      if (!response.ok || !result.url) throw new Error("link_unavailable");
      setPrivateLink(result.url);
    } catch {
      setPrivateLinkError("No se pudo obtener el enlace privado.");
    } finally {
      setPrivateLinkPending(false);
    }
  };

  const regeneratePrivateLink = async () => {
    if (
      !window.confirm(
        "El enlace anterior dejará de funcionar inmediatamente. ¿Deseas regenerarlo?"
      )
    ) {
      return;
    }
    setPrivateLinkPending(true);
    setPrivateLinkError("");
    try {
      const response = await fetch(
        `/api/admin/propiedades/${id}/private-showing-link`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmation: "REGENERAR" }),
        }
      );
      const result = (await response.json()) as { ok?: boolean; url?: string };
      if (!response.ok || !result.url) throw new Error("regeneration_failed");
      setPrivateLink(result.url);
    } catch {
      setPrivateLinkError("No se pudo regenerar el enlace privado.");
    } finally {
      setPrivateLinkPending(false);
    }
  };

  const handleEstadoChange = (nextEstado: string) => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("estado", nextEstado);

    startTransition(async () => {
      try {
        await updatePropiedadEstadoAction(formData);
      } catch (error) {
        console.error(error);
        alert("No se pudo actualizar el estado.");
      }
    });
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("confirmacion", "BORRAR");

    startTransition(async () => {
      try {
        await deletePropiedadAction(formData);
      } catch (error) {
        console.error(error);
        alert("No se pudo borrar la propiedad.");
      }
    });
  };

  const handleToggleDestacado = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("destacado", String(!destacadoActual));

    startTransition(async () => {
      try {
        await toggleDestacadoAction(formData);
      } catch (error) {
        console.error(error);
        alert("No se pudo actualizar el estado de destacado.");
      }
    });
  };

  return (
    <div className="w-48 max-w-full space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/listados/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
        >
          Ver web
        </Link>

        <Link
          href={`/admin/propiedades/${id}/editar`}
          className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
        >
          Editar
        </Link>
      </div>

      <div>
        <button
          type="button"
          onClick={handleToggleDestacado}
          disabled={isPending}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 disabled:opacity-60 ${
            destacadoActual
              ? "border-[#d4af37] bg-[#fff9e6] text-[#d4af37] shadow-sm"
              : "border-[#d9d9d9] bg-white text-[#4d4d4d] hover:border-[#d4af37] hover:text-[#d4af37]"
          }`}
          title={destacadoActual ? "Quitar de destacados" : "Marcar como destacado"}
        >
          <svg
            className={`h-5 w-5 ${destacadoActual ? "fill-current" : "fill-none"}`}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      </div>

      <button
        type="button"
        onClick={() => void loadPrivateLink()}
        className="text-left text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
      >
        Enlace privado de visita
      </button>

      {showPrivateLink && (
        <div className="space-y-3 rounded-2xl border border-[#d9d9d9] bg-[#f8f8f8] p-3">
          {privateLinkPending && (
            <p className="text-xs text-[#4d4d4d]">Preparando enlace...</p>
          )}
          {privateLink && (
            <>
              <p className="break-words text-xs text-[#4d4d4d]">
                Enlace permanente disponible
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(privateLink)}
                  className="rounded-full bg-[#11518b] px-3 py-2 text-xs font-semibold text-white"
                >
                  Copiar enlace
                </button>
                <a
                  href={privateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[#11518b] px-3 py-2 text-xs font-semibold text-[#11518b]"
                >
                  Abrir formulario
                </a>
              </div>
              <button
                type="button"
                disabled={privateLinkPending}
                onClick={() => void regeneratePrivateLink()}
                className="text-xs font-semibold text-red-700 disabled:opacity-60"
              >
                Regenerar enlace privado
              </button>
            </>
          )}
          {privateLinkError && (
            <p role="alert" className="text-xs text-red-700">
              {privateLinkError}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowPrivateLink(false)}
            className="block text-xs font-medium text-[#4d4d4d]"
          >
            Cerrar
          </button>
        </div>
      )}

      <select
        defaultValue={estadoActual}
        onChange={(e) => handleEstadoChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-xl border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#4d4d4d] disabled:opacity-60"
      >
        <option value="disponible">Disponible</option>
        <option value="coming_soon">Próximamente</option>
        <option value="bajo_contrato">Bajo contrato</option>
        <option value="vendida">Vendida</option>
        <option value="rentada">Alquilada</option>
      </select>

      {!confirmandoBorrado ? (
        <button
          type="button"
          onClick={() => setConfirmandoBorrado(true)}
          disabled={isPending}
          className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-60"
        >
          {isPending ? "Procesando..." : "Borrar"}
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3">
          <span className="text-sm text-red-700">
            ¿Seguro que quieres borrarla?
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {isPending ? "Borrando..." : "Sí, borrar"}
            </button>

            <button
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
              disabled={isPending}
              className="rounded-full border border-[#d9d9d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#4d4d4d] transition hover:bg-[#f8f8f8] disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
