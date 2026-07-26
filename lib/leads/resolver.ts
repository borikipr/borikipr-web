import {
  normalizeLeadIdentity,
  normalizeNameForComparison,
  preserveOriginalValue,
} from "./normalization";

export type LeadStatus =
  | "new"
  | "active"
  | "do_not_contact"
  | "archived"
  | "merged";

export type LeadIdentityStatus =
  | "provisional"
  | "matched"
  | "conflict"
  | "reviewed";

export type LeadRecord = {
  id: string;
  name: string;
  emailOriginal: string | null;
  emailNormalized: string | null;
  phoneOriginal: string | null;
  phoneNormalized: string | null;
  status: LeadStatus;
  identityStatus: LeadIdentityStatus;
  firstSeenAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  mergedIntoLeadId: string | null;
};

export type NewLeadRecord = Pick<
  LeadRecord,
  | "name"
  | "emailOriginal"
  | "emailNormalized"
  | "phoneOriginal"
  | "phoneNormalized"
  | "identityStatus"
>;

export type LeadResolverTransaction = {
  lockIdentityKeys(keys: string[]): Promise<void>;
  findCandidates(identity: {
    emailNormalized: string | null;
    phoneNormalized: string | null;
  }): Promise<LeadRecord[]>;
  insertLead(lead: NewLeadRecord): Promise<LeadRecord>;
  markMatched(id: string): Promise<LeadRecord>;
};

export type LeadResolverStore = {
  withTransaction<T>(
    callback: (transaction: LeadResolverTransaction) => Promise<T>
  ): Promise<T>;
};

export type ResolveLeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type ResolveLeadResult = {
  lead: LeadRecord;
  outcome: "created" | "matched" | "conflict_created";
};

export class LeadIdentityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadIdentityValidationError";
  }
}

export function createLeadResolver(store: LeadResolverStore) {
  return {
    async resolveOrCreate(input: ResolveLeadInput): Promise<ResolveLeadResult> {
      const name = preserveOriginalValue(input.name);
      if (!name) {
        throw new LeadIdentityValidationError("A lead name is required.");
      }

      const identity = normalizeLeadIdentity(input);
      if (!identity.emailNormalized && !identity.phoneNormalized) {
        throw new LeadIdentityValidationError(
          "A confidently valid email or Puerto Rico/US phone is required."
        );
      }

      return store.withTransaction(async (transaction) => {
        const lockKeys = [
          identity.emailNormalized
            ? `lead-email:${identity.emailNormalized}`
            : null,
          identity.phoneNormalized
            ? `lead-phone:${identity.phoneNormalized}`
            : null,
        ].filter((value): value is string => Boolean(value));

        await transaction.lockIdentityKeys(lockKeys.sort());
        const candidates = await transaction.findCandidates(identity);
        const matchingLead = selectMatchingCanonicalLead(candidates, {
          name,
          emailNormalized: identity.emailNormalized,
          phoneNormalized: identity.phoneNormalized,
        });

        if (matchingLead) {
          return {
            lead: await transaction.markMatched(matchingLead.id),
            outcome: "matched",
          };
        }

        return createLead(
          transaction,
          name,
          identity,
          candidates.length > 0 ? "conflict" : "provisional"
        );
      });
    },
  };
}

export function selectMatchingCanonicalLead(
  candidates: LeadRecord[],
  identity: {
    name: string;
    emailNormalized: string | null;
    phoneNormalized: string | null;
  }
) {
  const compatibleName = normalizeNameForComparison(identity.name);
  const hasCompatibleName = (lead: LeadRecord) =>
    normalizeNameForComparison(lead.name) === compatibleName;

  if (identity.emailNormalized && identity.phoneNormalized) {
    const exactMatches = candidates.filter(
      (lead) =>
        lead.emailNormalized === identity.emailNormalized &&
        lead.phoneNormalized === identity.phoneNormalized &&
        hasCompatibleName(lead)
    );
    return exactMatches.length === 1 ? exactMatches[0] : null;
  }

  const identifierMatches = candidates.filter((lead) => {
    if (identity.emailNormalized) {
      return lead.emailNormalized === identity.emailNormalized;
    }
    return (
      Boolean(identity.phoneNormalized) &&
      lead.phoneNormalized === identity.phoneNormalized
    );
  });
  const compatibleMatches = identifierMatches.filter(hasCompatibleName);
  return compatibleMatches.length === 1 ? compatibleMatches[0] : null;
}

async function createLead(
  transaction: LeadResolverTransaction,
  name: string,
  identity: ReturnType<typeof normalizeLeadIdentity>,
  identityStatus: "provisional" | "conflict"
): Promise<ResolveLeadResult> {
  const lead = await transaction.insertLead({
    name,
    emailOriginal: identity.emailOriginal,
    emailNormalized: identity.emailNormalized,
    phoneOriginal: identity.phoneOriginal,
    phoneNormalized: identity.phoneNormalized,
    identityStatus,
  });

  return {
    lead,
    outcome: identityStatus === "conflict" ? "conflict_created" : "created",
  };
}
