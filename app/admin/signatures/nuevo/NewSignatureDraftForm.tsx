"use client";

import { useRouter } from "next/navigation";
import { IconFileTypePdf, IconUpload, IconX } from "@tabler/icons-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { FormSection } from "@/components/admin/AdminUI";

type Option = Readonly<{ id: string; label: string }>;
type DocumentType = Readonly<{ id: string; label: string; scope: string }>;
type BrokerCandidate = Readonly<{ id: string; name: string; licenseNumber: string }>;

export default function NewSignatureDraftForm({
  documentTypes,
  brokerCandidates,
  leads,
  groups,
  minimumExpirationDate,
}: {
  documentTypes: readonly DocumentType[];
  brokerCandidates: readonly BrokerCandidate[];
  leads: readonly Option[];
  groups: readonly Option[];
  minimumExpirationDate: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requiresBrokerSignature, setRequiresBrokerSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHydrated(true), []);

  function selectFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    if (fileInputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInputRef.current.files = transfer.files;
    }
  }

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/signatures/drafts", {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
      });
      const body = (await response.json()) as {
        ok?: boolean;
        documentId?: string;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.documentId) {
        setMessage(body.error ?? "No se pudo crear el borrador.");
        return;
      }
      router.push(`/admin/signatures/${body.documentId}`);
      router.refresh();
    } catch {
      setMessage("No se pudo crear el borrador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="signature-new-document-form" onSubmit={submit}>
      <FormSection
        title="Documento"
        description="Información principal del PDF que se preparará para firma."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-semibold">Título interno</span>
            <input
              className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
              maxLength={200}
              name="title"
              required
            />
          </label>
          <label>
            <span className="text-sm font-semibold">Tipo de documento</span>
            <select
              className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
              name="documentType"
              required
              defaultValue=""
            >
              <option disabled value="">
                Selecciona
              </option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label} ·{" "}
                  {type.scope === "ordinary_brokerage"
                    ? "flujo ordinario de corretaje"
                    : "confirmar alcance/formalidades"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="text-sm font-semibold">PDF fuente</span>
          <label
            className={`signature-upload-zone mt-2 ${dragActive ? "is-dragging" : ""} ${selectedFile ? "has-file" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDragActive(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropFile}
          >
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              name="sourcePdf"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              ref={fileInputRef}
              required
              type="file"
            />
            {selectedFile ? (
              <span className="flex w-full items-center gap-3 text-left">
                <span className="signature-upload-icon">
                  <IconFileTypePdf aria-hidden="true" size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">
                    {selectedFile.name}
                  </strong>
                  <span className="text-xs text-slate-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · PDF
                    listo para validar
                  </span>
                </span>
                <button
                  aria-label="Quitar PDF seleccionado"
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                  onClick={(event) => {
                    event.preventDefault();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  type="button"
                >
                  <IconX aria-hidden="true" size={20} />
                </button>
              </span>
            ) : (
              <span className="grid justify-items-center gap-2 text-center">
                <span className="signature-upload-icon">
                  <IconUpload aria-hidden="true" size={26} />
                </span>
                <span>
                  <strong className="block">Arrastra tu PDF aquí</strong>
                  <span className="text-sm text-slate-600">
                    o selecciona un archivo
                  </span>
                </span>
              </span>
            )}
          </label>
          <span className="mt-2 block text-xs text-[#666]">
            Máximo 3 MB y 25 páginas. Se rechazará contenido cifrado, XFA,
            adjuntos, acciones, JavaScript o firmas digitales existentes.
          </span>
        </div>
      </FormSection>

      <div className="border-t border-slate-200 pt-6">
        <FormSection
          title="Relación CRM"
          description="Enlaces operacionales opcionales; no cambian quién puede firmar."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Lead 360 (opcional)</span>
              <select
                className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
                name="canonicalLeadId"
                defaultValue=""
              >
                <option value="">Sin enlace</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">
                Caso compartido (opcional)
              </span>
              <select
                className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
                name="leadGroupId"
                defaultValue=""
              >
                <option value="">Sin enlace</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </FormSection>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <FormSection
          title="Configuración"
          description="La expiración podrá revisarse antes del envío."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Forma de firma</span>
              <select
                className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
                name="routingMode"
                defaultValue="parallel"
              >
                <option value="parallel">En paralelo</option>
                <option value="sequential">En orden</option>
                <option value="grouped">Grupos mixtos</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-semibold">Fecha de expiración</span>
              <input
                className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3"
                min={minimumExpirationDate}
                name="expiresOn"
                required
                type="date"
              />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <input
              className="mt-1"
              aria-describedby="broker-signature-help"
              checked={requiresBrokerSignature}
              disabled={brokerCandidates.length === 0}
              name="requiresBrokerSignature"
              onChange={(event) => setRequiresBrokerSignature(event.target.checked)}
              type="checkbox"
              value="true"
            />
            <span>
              <strong>¿Requiere firma de corredor(a)?</strong>
              <span className="mt-1 block text-sm text-slate-600" id="broker-signature-help">
                Si aplica, el corredor(a) se añadirá como firmante final.
              </span>
            </span>
          </label>
          {requiresBrokerSignature && brokerCandidates.length === 1 ? (
            <p aria-live="polite" className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <strong>Firmará al final:</strong> {brokerCandidates[0].name}
            </p>
          ) : null}
          {requiresBrokerSignature && brokerCandidates.length > 1 ? (
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Corredor(a) firmante</span>
              <select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="brokerCandidateId" required>
                <option value="">Selecciona un corredor(a)</option>
                {brokerCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · Lic. {candidate.licenseNumber}</option>)}
              </select>
            </label>
          ) : null}
          {brokerCandidates.length === 0 ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              No hay un corredor autorizado disponible para este documento.
            </p>
          ) : null}
        </FormSection>
      </div>
      {message && (
        <p
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {message}
        </p>
      )}
      <button
        className="btn-primary"
        disabled={busy || !hydrated}
        type="submit"
      >
        {!hydrated
          ? "Preparando…"
          : busy
            ? "Validando PDF…"
            : "Guardar y continuar"}
      </button>
    </form>
  );
}
