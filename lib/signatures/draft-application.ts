import { randomUUID } from "node:crypto";
import type { createSignatureDomainServices } from "./domain/service";
import { signatureSourceR2Key } from "./domain/r2-keys";
import { getSignatureDocumentTypeDefinition } from "./document-classification";
import {
  inspectPdfCompatibility,
  PdfCompatibilityError,
} from "./prototype/inspect";
import type { SignatureSourceStorage } from "./storage";
import type { SignatureDatabase } from "./domain/types";
import {
  MAX_SIGNATURE_SOURCE_BYTES,
  sanitizeSignatureFilename,
} from "./storage";
import { resolveSignatureBrokerCandidate } from "./broker-candidates";

const MAX_SIGNATURE_PAGES = 25;

export class SignatureDraftValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "SignatureDraftValidationError";
  }
}

function optionalUuid(value: string | null | undefined) {
  const normalized = value?.trim() || null;
  if (
    normalized &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    throw new SignatureDraftValidationError("signature_link_id_invalid");
  }
  return normalized;
}

export function createSignatureDraftApplicationService({
  domain,
  database,
  storage,
}: {
  domain: ReturnType<typeof createSignatureDomainServices>;
  database: SignatureDatabase;
  storage: SignatureSourceStorage;
}) {
  return {
    async createDraft(input: {
      title: string;
      documentType: string;
      createdByAdminId: string;
      canonicalLeadId?: string | null;
      leadGroupId?: string | null;
      expiresAt?: Date | null;
      filename: string;
      mimeType: string;
      bytes: Uint8Array;
      routingMode?: "parallel" | "sequential" | "grouped";
      requiresBrokerSignature?: boolean;
      brokerCandidateId?: string | null;
    }) {
      const title = input.title.trim();
      if (title.length < 1 || title.length > 200) {
        throw new SignatureDraftValidationError("signature_title_invalid");
      }
      if (!getSignatureDocumentTypeDefinition(input.documentType)) {
        throw new SignatureDraftValidationError("signature_document_type_unknown");
      }
      const broker = input.requiresBrokerSignature
        ? await resolveSignatureBrokerCandidate(database, input.brokerCandidateId)
        : null;
      if (input.requiresBrokerSignature && !broker) {
        throw new SignatureDraftValidationError("signature_broker_unavailable");
      }
      const filename = sanitizeSignatureFilename(input.filename);
      let report;
      try {
        report = await inspectPdfCompatibility({
          bytes: input.bytes,
          mimeType: input.mimeType,
          limits: {
            maximumSourceBytes: MAX_SIGNATURE_SOURCE_BYTES,
            maximumPages: MAX_SIGNATURE_PAGES,
          },
        });
      } catch (error) {
        if (error instanceof PdfCompatibilityError) {
          throw new SignatureDraftValidationError(error.code);
        }
        throw error;
      }
      const documentId = randomUUID();
      const sourceR2Key = signatureSourceR2Key(
        documentId,
        1,
        report.sourceSha256
      );
      const sourceObject = {
        key: sourceR2Key,
        bytes: input.bytes,
        mimeType: "application/pdf" as const,
        byteCount: report.byteSize,
        sourceSha256: report.sourceSha256,
      };
      const uploadResult = await storage.putSource(sourceObject);
      try {
        const created = await domain.createDraftWithVersion({
          documentId,
          title,
          documentType: input.documentType,
          createdByAdminId: input.createdByAdminId,
          canonicalLeadId: optionalUuid(input.canonicalLeadId),
          leadGroupId: optionalUuid(input.leadGroupId),
          expiresAt: input.expiresAt ?? null,
          routingMode: input.routingMode ?? "parallel",
          requiresBrokerSignature: input.requiresBrokerSignature ?? false,
          filename,
          byteCount: report.byteSize,
          pageCount: report.pageCount,
          sourceSha256: report.sourceSha256,
          pageGeometryManifest: report.pages,
          documentCreatedIdempotencyKey: randomUUID(),
          versionCreatedIdempotencyKey: randomUUID(),
        });
        if (input.requiresBrokerSignature) {
          await domain.addParticipant({
            documentVersionId:created.documentVersionId,nameSnapshot:broker!.name,
            emailSnapshot:broker!.email,role:"Corredor(a)",routingOrder:8,
            isBrokerFinalSigner:true,actorAdminId:input.createdByAdminId,idempotencyKey:randomUUID(),
          });
        }
        return {
          documentId: created.documentId,
          documentVersionId: created.documentVersionId,
          compatibility: {
            compatible: true as const,
            pageCount: report.pageCount,
            byteCount: report.byteSize,
            sourceSha256: report.sourceSha256,
            hasAcroForm: report.hasAcroForm,
          },
        };
      } catch (error) {
        if (uploadResult === "created") {
          await storage.deleteSourceIfExact(sourceObject).catch(() => false);
        }
        throw error;
      }
    },
  };
}
