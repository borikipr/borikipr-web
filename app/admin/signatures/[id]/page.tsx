import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SignatureDraftEditor from "@/components/admin/signatures/SignatureDraftEditor";
import SignatureDocumentActions from "@/components/admin/signatures/SignatureDocumentActions";
import IsolatedDeliveryControl from "@/components/admin/signatures/IsolatedDeliveryControl";
import SignatureRoutingSummary from "@/components/admin/signatures/SignatureRoutingSummary";
import {
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/AdminPageShell";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import {
  signatureDeliveryLabel,
  signatureEventLabel,
  signatureOperationalStatus,
  signatureRequiresAttention,
  signatureStatusLabel,
  signatureStatusTone,
} from "@/lib/signatures/admin-ux";
import { getSignatureDocumentTypeDefinition } from "@/lib/signatures/document-classification";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { evaluateSignatureSendReadiness } from "@/lib/signatures/send-readiness";
import {
  isInternalCanarySigningEnabled,
  isProductionInternalCanaryCapabilityEnabled,
  isPublicSigningEnabled,
} from "@/lib/signatures/public-config";
import { isSignerAccessAuthorized } from "@/lib/signatures/canary-gate";
import { inspectProductionPublicLaunchGate } from "@/lib/signatures/public-launch";
import { getSignatureSecurityConfig } from "@/lib/signatures/config";
import { inspectSignatureRetentionPolicy } from "@/lib/signatures/retention-policy";
import { inspectSignaturePrivacyDisclosure } from "@/lib/signatures/privacy-disclosure";
import {
  loadActivePrivacyDisclosure,
  loadActiveRetentionPolicy,
} from "@/lib/signatures/governance-config";
import { evaluateSignaturePreflight } from "@/lib/signatures/preflight";
import { formatPuertoRicoDate, formatPuertoRicoDateTime } from "@/lib/puerto-rico-time";
import { buildSignatureRoutingStages } from "@/lib/signatures/routing-ux";
import { inspectSignatureDeletionEligibility } from "@/lib/signatures/draft-lifecycle";

export default async function SignatureDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  const { id } = await params;
  const database = createPostgresSignatureDatabase(sql);
  const repository = createSignatureAdminRepository(database);
  const detail = await repository.detail(id);
  if (!detail) notFound();
  const definition = getSignatureDocumentTypeDefinition(detail.documentType);
  const publicSigningEnabled = isPublicSigningEnabled();
  const internalCanaryEnabled =
    isInternalCanarySigningEnabled() ||
    isProductionInternalCanaryCapabilityEnabled();
  let keysConfigured = false;
  try {
    getSignatureSecurityConfig();
    keysConfigured = true;
  } catch {
    keysConfigured = false;
  }
  const [{ preflight_expiration: preflightExpiration }] = await sql<
    { preflight_expiration: Date }[]
  >`SELECT now()+interval '1 hour' preflight_expiration`;
  const [
    durableRetention,
    durablePrivacy,
    participantAuthorizations,
    publicLaunchGate,
    preflight,
  ] = await Promise.all([
    loadActiveRetentionPolicy(database),
    loadActivePrivacyDisclosure(database),
    !publicSigningEnabled && internalCanaryEnabled ? Promise.all(
      detail.participants.map((participant) =>
        isSignerAccessAuthorized(database, {
          participantId: participant.id,
          documentVersionId: detail.version.id,
        }),
      ),
    ) : Promise.resolve([]),
    inspectProductionPublicLaunchGate(database),
    evaluateSignaturePreflight({
      database,
      documentId: id,
      locales: ["es-PR"],
      participantEmails: detail.participants.map((p) => p.email),
      documentTypes: [detail.documentType],
      environment: "production",
      authorizationType: "internal_canary",
      authorizationExpiresAt: preflightExpiration,
    }),
  ]);
  const scoped =
    detail.participants.length > 0 && participantAuthorizations.length === detail.participants.length &&
    participantAuthorizations.every(Boolean);
  const activationMode =
    publicSigningEnabled && publicLaunchGate.allowed
      ? "public"
      : internalCanaryEnabled && scoped
        ? "internal_canary"
        : "disabled";
  const readiness = await evaluateSignatureSendReadiness({
    database,
    documentId: id,
    locale: "es-PR",
    publicSigningEnabled: activationMode !== "disabled",
    eventKeysConfigured: keysConfigured,
    retentionPolicyConfigured:
      Boolean(durableRetention) || inspectSignatureRetentionPolicy().configured,
    privacyDisclosureConfigured:
      Boolean(durablePrivacy) || inspectSignaturePrivacyDisclosure().configured,
  });
  const latestDelivery =
    detail.participants
      .map((participant) => participant.lastDeliveryStatus)
      .find((status) => status === "failed") ??
    detail.participants.find((participant) => participant.lastDeliveryStatus)
      ?.lastDeliveryStatus;
  const attention = signatureRequiresAttention({
    status: detail.status,
    deliveryStatus: latestDelivery,
    expiresAt: detail.expiresAt,
  });
  const operationalStatus = signatureOperationalStatus({
    status: detail.status,
    participants: detail.participants,
    deliveryStatus: latestDelivery,
    expiresAt: detail.expiresAt,
  });
  const finalCompletedAt = detail.participants
    .map((participant) => participant.completedAt)
    .filter((value): value is string | Date => Boolean(value))
    .sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime(),
    )[0];
  const humanStageByParticipant = new Map(
    buildSignatureRoutingStages(detail.participants, detail.routingMode).flatMap(
      (stage, index) => stage.participants.map((participant) => [participant.id, index + 1] as const),
    ),
  );
  const operationallyHidden = Boolean(detail.operationallyHiddenAt && !detail.operationallyRestoredAt);
  const deletionEligibility = await inspectSignatureDeletionEligibility(database, id);

  return (
    <AdminPageShell>
      <div className={detail.status === "completed" ? "signature-completed-header" : "signature-document-header"}>
        <AdminPageHeader
          breadcrumbs={[
            { href: "/admin", label: "Admin" },
            { href: "/admin/signatures", label: "Firmas" },
            { label: detail.title },
          ]}
          eyebrow={detail.status === "completed" ? "Firmas · Completado" : "Firmas · Documento"}
          title={detail.title}
          description={
            detail.status === "completed"
              ? "Consulta participantes, ruta, documento firmado y certificado."
              : "Prepara destinatarios y campos, revisa todo y envía únicamente cuando los controles estén completos."
          }
          actions={
            !detail.version.sourceDeleted && detail.status !== "archived" ? (
              <Link
                className="btn-secondary"
                href={`/admin/signatures/${detail.id}/source`}
                target="_blank"
              >
                Abrir PDF
              </Link>
            ) : undefined
          }
        />
      </div>

      {attention ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <h2 className="font-semibold">Requiere atención</h2>
          <p className="mt-1 text-sm">
            {latestDelivery === "failed"
              ? "La última invitación no pudo entregarse. Revisa el destinatario antes de reenviar."
              : "La solicitud expiró antes de completarse."}
          </p>
        </section>
      ) : null}
      <section
        className="signature-document-summary"
        aria-label="Resumen del documento"
        id="resumen"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${signatureStatusTone(detail.status)}`}
            >
              {signatureStatusLabel(detail.status)}
            </span>
            <p className="mt-2 text-lg font-semibold">{operationalStatus}</p>
          </div>
          {detail.status === "completed" && finalCompletedAt ? (
            <p className="text-sm text-slate-600">
              Completado {formatPuertoRicoDateTime(finalCompletedAt)}
            </p>
          ) : null}
        </div>
        <dl className="admin-meta-grid mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt>Enviado por</dt>
            <dd>{detail.createdByName}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>
              {detail.version.pageCount} páginas ·{" "}
              {(detail.version.byteCount / 1024).toFixed(1)} KB
            </dd>
          </div>
          <div>
            <dt>Firmas</dt>
            <dd>
              {
                detail.participants.filter(
                  (participant) => participant.status === "completed",
                ).length
              }{" "}
              de {detail.participants.length}
            </dd>
          </div>
          <div>
            <dt>Expiración</dt>
            <dd>
              {detail.expiresAt
                ? formatPuertoRicoDate(detail.expiresAt)
                : "Sin fecha"}
            </dd>
          </div>
        </dl>
      </section>

      {detail.status === "completed" && (
        <section className="signature-download-bar">
          <div>
            <p className="font-semibold">Documento completado</p>
            <p className="text-sm text-slate-600">
              Descarga el resultado y su certificado directamente desde Borikí.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="btn-primary"
              href={`/admin/signatures/${detail.id}/final`}
            >
              Descargar documento firmado
            </Link>
            <Link
              className="btn-secondary"
              href={`/admin/signatures/${detail.id}/certificate`}
            >
              Descargar certificado
            </Link>
          </div>
        </section>
      )}
      {detail.participants.length && detail.status !== "draft" ? (
        <section className="signature-participant-overview grid gap-4 lg:grid-cols-2">
          <SignatureRoutingSummary
            mode={detail.routingMode}
            participants={detail.participants}
          />
          <section className="surface-card p-5">
            <h2 className="font-semibold">Destinatarios</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {detail.participants.map((participant) => (
                <li
                  className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  key={participant.id}
                >
                  <div>
                    <p className="font-semibold">
                      {participant.name} · {participant.role}
                    </p>
                    <p className="text-xs text-slate-600">
                      Etapa {humanStageByParticipant.get(participant.id) ?? 1}
                      {participant.isBrokerFinalSigner ? " · Firma final" : ""}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p>
                      {participant.status === "completed"
                        ? "Firma completada"
                        : participant.status === "viewed"
                          ? "Documento visto"
                          : participant.status === "consented"
                            ? "Consentimiento aceptado"
                            : participant.status === "invited"
                              ? "Invitación enviada"
                              : "En espera"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {signatureDeliveryLabel(participant.lastDeliveryStatus)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </section>
      ) : null}
      {process.env.NODE_ENV !== "production" &&
        process.env.SIGNING_ISOLATED_ENVIRONMENT === "true" &&
        !["draft", "completed"].includes(detail.status) && (
          <IsolatedDeliveryControl />
        )}
      {definition?.scope !== "ordinary_brokerage" && (
        <section className="surface-card border-l-4 border-amber-500 p-5 text-sm text-amber-900">
          {definition?.guidance}
        </section>
      )}

      {detail.status === "archived" || operationallyHidden ? (
        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">
            Fuera de solicitudes activas
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Borikí conserva automáticamente la evidencia que deba mantenerse.
            Este registro continúa disponible como historial.
          </p>
        </section>
      ) : detail.status !== "completed" ? (
        <div id="preparacion"><SignatureDraftEditor
          detail={detail}
          readiness={readiness}
          preflight={preflight}
          activationMode={activationMode}
        /></div>
      ) : null}
      <SignatureDocumentActions
        documentId={detail.id}
        title={detail.title}
        status={detail.status}
        operationallyHidden={operationallyHidden}
        sourceAvailable={!detail.version.sourceDeleted}
        deletionEligible={deletionEligibility.eligible}
        deletionMode={deletionEligibility.mode}
      />

      <section className="signature-activity-panel" id="historial" aria-labelledby="actividad-heading">
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="flex flex-col">
            <strong id="actividad-heading">Actividad</strong>
            <small className="mt-1 text-sm font-normal text-slate-600">Historial inmutable de la solicitud</small>
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {detail.events.length} eventos
          </span>
        </header>
        <ol className="divide-y divide-slate-100 px-5">
          {detail.events.map((event) => (
            <li
              className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={event.id}
            >
              <p className="text-sm font-medium">
                {signatureEventLabel(event.eventType)}
              </p>
              <time
                className="text-xs text-slate-500"
                dateTime={new Date(event.createdAt).toISOString()}
              >
                {formatPuertoRicoDateTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
        {!detail.events.length && (
          <p className="p-5 text-sm text-slate-500">
            No hay actividad registrada.
          </p>
        )}
      </section>

      {detail.status === "completed" ? (
        <p className="text-sm text-slate-600">
          {/* Detalles avanzados moved out of the operational detail view; protected evidence remains available here. */}
          <Link className="font-semibold text-[#11518b] hover:underline" href={`/admin/signatures/${detail.id}/evidence`}>
            Abrir evidencia técnica
          </Link>
        </p>
      ) : null}
    </AdminPageShell>
  );
}
