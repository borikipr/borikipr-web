import {
  normalizeEmail,
  normalizeNameForComparison,
  normalizePuertoRicoUsPhone,
} from "./normalization";

export type HistoricalPriorityRegistration = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  leadId?: string | null;
};

export type BackfillLeadCandidate = {
  id: string;
  name: string;
  emailNormalized: string | null;
  phoneNormalized: string | null;
};

export type PriorityRegistrationBackfillAction = {
  registrationId: string;
  existingLeadId: string | null;
  identityGroupKey: string;
};

export type PriorityRegistrationBackfillPlan = {
  actions: PriorityRegistrationBackfillAction[];
  summary: {
    registrationsReviewed: number;
    canonicalLeadsToCreate: number;
    registrationsToLink: number;
    ambiguousGroups: number;
    conflicts: number;
    registrationsLeftUnlinked: number;
    alreadyLinked: number;
  };
};

export function planPriorityRegistrationBackfill(
  registrations: HistoricalPriorityRegistration[],
  existingLeads: BackfillLeadCandidate[]
): PriorityRegistrationBackfillPlan {
  const normalized = registrations.map((registration) => ({
    registration,
    name: normalizeNameForComparison(registration.name),
    email: normalizeEmail(registration.email),
    phone: normalizePuertoRicoUsPhone(registration.phone),
  }));
  const emailNames = identifierNames(normalized, "email");
  const phoneNames = identifierNames(normalized, "phone");
  const actions: PriorityRegistrationBackfillAction[] = [];
  const ambiguousKeys = new Set<string>();
  let conflicts = 0;
  let alreadyLinked = 0;
  let registrationsLeftUnlinked = 0;

  for (const item of normalized) {
    if (item.registration.leadId) {
      alreadyLinked += 1;
      continue;
    }

    if (!item.email && !item.phone) {
      registrationsLeftUnlinked += 1;
      continue;
    }

    const sharedEmailNames = item.email ? emailNames.get(item.email) : null;
    const sharedPhoneNames = item.phone ? phoneNames.get(item.phone) : null;
    const ambiguousIdentifier =
      (sharedEmailNames?.size ?? 0) > 1 ||
      (sharedPhoneNames?.size ?? 0) > 1;
    const candidates = existingLeads.filter(
      (lead) =>
        (item.email && lead.emailNormalized === item.email) ||
        (item.phone && lead.phoneNormalized === item.phone)
    );
    const compatibleCandidates = candidates.filter(
      (lead) => normalizeNameForComparison(lead.name) === item.name
    );
    const candidateConflict =
      candidates.length > 1 ||
      (candidates.length === 1 && compatibleCandidates.length !== 1);

    if (ambiguousIdentifier || candidateConflict) {
      if ((sharedEmailNames?.size ?? 0) > 1 && item.email) {
        ambiguousKeys.add(`email:${item.email}`);
      }
      if ((sharedPhoneNames?.size ?? 0) > 1 && item.phone) {
        ambiguousKeys.add(`phone:${item.phone}`);
      }
      if (candidateConflict) {
        ambiguousKeys.add(
          `candidate:${candidates.map((lead) => lead.id).sort().join("|")}`
        );
      }
      conflicts += candidateConflict ? 1 : 0;
      registrationsLeftUnlinked += 1;
      continue;
    }

    actions.push({
      registrationId: item.registration.id,
      existingLeadId: compatibleCandidates[0]?.id ?? null,
      identityGroupKey: `${item.name}|${item.email ?? ""}|${item.phone ?? ""}`,
    });
  }

  const newIdentityGroups = new Set(
    actions
      .filter((action) => !action.existingLeadId)
      .map((action) => action.identityGroupKey)
  );

  return {
    actions,
    summary: {
      registrationsReviewed: registrations.length,
      canonicalLeadsToCreate: newIdentityGroups.size,
      registrationsToLink: actions.length,
      ambiguousGroups: ambiguousKeys.size,
      conflicts,
      registrationsLeftUnlinked,
      alreadyLinked,
    },
  };
}

function identifierNames(
  normalized: Array<{
    name: string;
    email: string | null;
    phone: string | null;
  }>,
  field: "email" | "phone"
) {
  const names = new Map<string, Set<string>>();
  for (const item of normalized) {
    const identifier = item[field];
    if (!identifier) continue;
    const set = names.get(identifier) ?? new Set<string>();
    set.add(item.name);
    names.set(identifier, set);
  }
  return names;
}
