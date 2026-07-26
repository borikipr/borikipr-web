import { inspectPrivateR2Object } from "@/lib/r2";
import {
  normalizeLeadIdentity,
  preserveOriginalValue,
} from "./normalization";
import {
  selectMatchingCanonicalLead,
  type LeadRecord,
} from "./resolver";
import type { BuyerProfileDocumentType } from "./property-buyer-profile";

export type ReusableFinancialDocument = {
  sourceProfileId: string;
  ownerLeadId: string;
  documentType: BuyerProfileDocumentType;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

type CandidateLeadRow = {
  id: string;
  name: string;
  email_original: string | null;
  email_normalized: string | null;
  phone_original: string | null;
  phone_normalized: string | null;
  status: LeadRecord["status"];
  identity_status: LeadRecord["identityStatus"];
  first_seen_at: Date | string;
  last_activity_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  merged_into_lead_id: string | null;
};

type DocumentRow = {
  id: string;
  lead_id: string;
  document_type: BuyerProfileDocumentType;
  document_object_key: string;
  document_original_name: string;
  document_content_type: string;
  document_size_bytes: number | string;
};

export type FinancialDocumentReuseDependencies = {
  loadCandidates: (identity: {
    emailNormalized: string | null;
    phoneNormalized: string | null;
  }) => Promise<LeadRecord[]>;
  loadDocuments: (
    leadId: string,
    documentType: BuyerProfileDocumentType
  ) => Promise<DocumentRow[]>;
  inspectObject: typeof inspectPrivateR2Object;
};

export function requiredFinancialDocumentType(
  purchaseMethod: string
): BuyerProfileDocumentType | null {
  if (purchaseMethod === "Financiamiento") return "prequalification_letter";
  if (purchaseMethod === "Cash") return "proof_of_funds";
  return null;
}

export async function findReusableFinancialDocument(
  input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    purchaseMethod: string;
  },
  dependencies: FinancialDocumentReuseDependencies = productionDependencies
): Promise<ReusableFinancialDocument | null> {
  const name = preserveOriginalValue(input.name);
  const identity = normalizeLeadIdentity(input);
  const documentType = requiredFinancialDocumentType(input.purchaseMethod);
  if (
    !name ||
    !documentType ||
    (!identity.emailNormalized && !identity.phoneNormalized)
  ) {
    return null;
  }

  const candidates = await dependencies.loadCandidates({
    emailNormalized: identity.emailNormalized,
    phoneNormalized: identity.phoneNormalized,
  });
  const lead = selectMatchingCanonicalLead(candidates, {
    name,
    emailNormalized: identity.emailNormalized,
    phoneNormalized: identity.phoneNormalized,
  });
  if (!lead) return null;

  const documents = await dependencies.loadDocuments(lead.id, documentType);

  for (const document of documents) {
    const sizeBytes = Number(document.document_size_bytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) continue;
    const object = await dependencies.inspectObject(
      document.document_object_key
    );
    if (
      !object.exists ||
      object.contentLength !== sizeBytes ||
      !object.contentType ||
      object.contentType.toLowerCase() !==
        document.document_content_type.toLowerCase()
    ) {
      continue;
    }
    return {
      sourceProfileId: document.id,
      ownerLeadId: document.lead_id,
      documentType,
      objectKey: document.document_object_key,
      originalName: document.document_original_name,
      contentType: document.document_content_type,
      sizeBytes,
    };
  }

  return null;
}

const productionDependencies: FinancialDocumentReuseDependencies = {
  async loadCandidates(identity) {
    const { sql } = await import("@/lib/db");
    const candidates = await sql.unsafe<CandidateLeadRow[]>(
      `SELECT
       id::text,
       name,
       email_original,
       email_normalized,
       phone_original,
       phone_normalized,
       status,
       identity_status,
       first_seen_at,
       last_activity_at,
       created_at,
       updated_at,
       merged_into_lead_id::text
     FROM public.leads
     WHERE status <> 'merged'
       AND (
         ($1::text IS NOT NULL AND email_normalized = $1)
         OR ($2::text IS NOT NULL AND phone_normalized = $2)
       )`,
      [identity.emailNormalized, identity.phoneNormalized]
    );
    return candidates.map(mapCandidateLead);
  },
  async loadDocuments(leadId, documentType) {
    const { sql } = await import("@/lib/db");
    return sql.unsafe<DocumentRow[]>(
      `SELECT
       id::text,
       lead_id::text,
       document_type,
       document_object_key,
       document_original_name,
       document_content_type,
       document_size_bytes
     FROM public.property_buyer_profiles
     WHERE lead_id = $1::uuid
       AND document_type = $2
       AND document_status = 'uploaded'
       AND document_object_key IS NOT NULL
       AND document_original_name IS NOT NULL
       AND document_content_type IS NOT NULL
      AND document_size_bytes IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 5`,
      [leadId, documentType]
    );
  },
  inspectObject: inspectPrivateR2Object,
};

function mapCandidateLead(row: CandidateLeadRow): LeadRecord {
  return {
    id: row.id,
    name: row.name,
    emailOriginal: row.email_original,
    emailNormalized: row.email_normalized,
    phoneOriginal: row.phone_original,
    phoneNormalized: row.phone_normalized,
    status: row.status,
    identityStatus: row.identity_status,
    firstSeenAt: new Date(row.first_seen_at),
    lastActivityAt: new Date(row.last_activity_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    mergedIntoLeadId: row.merged_into_lead_id,
  };
}
