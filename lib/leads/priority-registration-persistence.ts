export type PriorityRegistrationProperty = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

export type PriorityRegistrationPersistenceInput = {
  propertyId: string;
  propertySlug: string;
  name: string;
  phone: string;
  email: string;
  purchaseType: string;
  purchaseOther: string | null;
  prequalifiedStatus: string | null;
  propertySize: string;
  searchRange: string;
  wantsVisit: boolean;
  additionalInfo: string | null;
};

export type PriorityRegistrationPersistenceResult = {
  id: string;
  leadId: string | null;
  created: boolean;
  property: PriorityRegistrationProperty;
};

export type PriorityRegistrationTransaction = {
  lockProperty(
    propertyId: string,
    propertySlug: string
  ): Promise<PriorityRegistrationProperty | null>;
  lockDuplicateKey(propertyId: string, normalizedEmail: string): Promise<void>;
  findDuplicate(
    propertyId: string,
    normalizedEmail: string
  ): Promise<{ id: string; leadId: string | null } | null>;
  resolveLead(input: {
    name: string;
    email: string;
    phone: string;
  }): Promise<{ id: string }>;
  insertRegistration(input: {
    registration: PriorityRegistrationPersistenceInput;
    property: PriorityRegistrationProperty;
    leadId: string;
  }): Promise<{ id: string }>;
};

export type PriorityRegistrationStore = {
  withTransaction<T>(
    callback: (transaction: PriorityRegistrationTransaction) => Promise<T>
  ): Promise<T>;
};

export class PriorityRegistrationPersistenceError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404,
    readonly reason: "property_not_found" | "property_not_active"
  ) {
    super(message);
    this.name = "PriorityRegistrationPersistenceError";
  }
}

export async function persistPriorityRegistrationWithStore(
  store: PriorityRegistrationStore,
  input: PriorityRegistrationPersistenceInput
): Promise<PriorityRegistrationPersistenceResult> {
  return store.withTransaction(async (transaction) => {
    const property = await transaction.lockProperty(
      input.propertyId,
      input.propertySlug
    );

    if (!property) {
      throw new PriorityRegistrationPersistenceError(
        "No encontramos la propiedad seleccionada.",
        404,
        "property_not_found"
      );
    }

    if (property.status !== "coming_soon") {
      throw new PriorityRegistrationPersistenceError(
        "El registro prioritario no está activo para esta propiedad.",
        403,
        "property_not_active"
      );
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    await transaction.lockDuplicateKey(property.id, normalizedEmail);
    const duplicate = await transaction.findDuplicate(
      property.id,
      normalizedEmail
    );

    if (duplicate) {
      return {
        id: duplicate.id,
        leadId: duplicate.leadId,
        created: false,
        property,
      };
    }

    const lead = await transaction.resolveLead({
      name: input.name,
      email: input.email,
      phone: input.phone,
    });
    const inserted = await transaction.insertRegistration({
      registration: input,
      property,
      leadId: lead.id,
    });

    return {
      id: inserted.id,
      leadId: lead.id,
      created: true,
      property,
    };
  });
}
