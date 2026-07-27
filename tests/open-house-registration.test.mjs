import assert from "node:assert/strict";
import { File as NodeFile } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  buildOpenHouseDocumentObjectKey,
  buildOpenHouseShowingEventKey,
  isOpenHousePersistenceEnabled,
  OpenHouseValidationError,
  parseOpenHouseRegistrationFormData,
  validateOpenHouseForProperty,
} from "../lib/leads/open-house-registration.ts";
import {
  buildOpenHouseInternalEmail,
} from "../lib/leads/open-house-registration-email.ts";
import { buildOpenHouseCustomerEmail } from "../lib/leads/open-house-registration-customer-email.ts";
import { processOpenHousePostCommit } from "../lib/leads/open-house-registration-postcommit.ts";
import { findReusableFinancialDocument } from "../lib/leads/financial-document-reuse.ts";
import {
  normalizeEmail,
  normalizePuertoRicoUsPhone,
} from "../lib/leads/normalization.ts";

if (!globalThis.File) globalThis.File = NodeFile;

const showingAt = "2035-08-01T18:00:00.000Z";

function baseForm(overrides = {}) {
  const values = {
    idempotencyKey: randomUUID(),
    propertyId: randomUUID(),
    propertySlug: "casa-open-house",
    showingAt,
    nombre: "Persona Prueba",
    telefono: "787-555-1234",
    email: "open-house@example.test",
    metodo_compra: "Financiamiento",
    metodoCompraOtro: "",
    disponibilidad_visita: "Sí",
    fondos_gastos_cierre: "Sí",
    trabajando_con_corredor: "No",
    nombre_corredor: "",
    telefono_corredor: "",
    solarContractAcceptance: "",
    respuesta_personalizada: "",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    data.set(key, value instanceof NodeFile ? value : String(value));
  }
  return data;
}

function propertyFor(input, overrides = {}) {
  return {
    id: input.propertyId,
    slug: input.propertySlug,
    title: "Casa Open House",
    status: "disponible",
    origin: "propio",
    mayPublishOnWeb: false,
    showingFormActive: true,
    showingAt: new Date(showingAt),
    requiresPrequalification: false,
    hasSolarLease: false,
    ...overrides,
  };
}

function expectReason(form, reason) {
  assert.throws(
    () => parseOpenHouseRegistrationFormData(form),
    (error) => error instanceof OpenHouseValidationError && error.reason === reason
  );
}

test("valid financing, Cash, and Otros registrations use canonical submitted values", () => {
  const financing = parseOpenHouseRegistrationFormData(baseForm());
  assert.equal(financing.purchaseMethod, "Financiamiento");
  assert.equal(financing.workingWithBroker, "No");

  const proof = new NodeFile(["proof"], "proof.pdf", { type: "application/pdf" });
  const cash = parseOpenHouseRegistrationFormData(
    baseForm({ metodo_compra: "Cash", evidencia_fondos_archivo: proof })
  );
  assert.equal(cash.purchaseMethod, "Cash");
  assert.equal(cash.documentKind, "proof_of_funds");

  const other = parseOpenHouseRegistrationFormData(
    baseForm({
      metodo_compra: "Otro",
      metodoCompraOtro: "Programa especial",
    })
  );
  assert.equal(other.purchaseMethod, "Otro");
  assert.equal(other.purchaseMethodOther, "Programa especial");
  assert.equal(other.documentKind, null);
});

test("basic malformed direct requests are rejected", async (t) => {
  const cases = [
    ["invalid email", { email: "bad" }, "invalid_email"],
    ["invalid phone", { telefono: "12345" }, "invalid_phone"],
    ["invalid purchase method", { metodo_compra: "Efectivo" }, "invalid_purchase_method"],
    ["Otros missing detail", { metodo_compra: "Otro" }, "missing_purchase_method_other"],
    ["hidden other detail", { metodoCompraOtro: "No aplica" }, "unexpected_purchase_method_other"],
    ["invalid attendance", { disponibilidad_visita: "Tal vez" }, "invalid_attendance_answer"],
    ["invalid closing funds", { fondos_gastos_cierre: "En proceso" }, "invalid_closing_funds_answer"],
    ["invalid broker answer", { trabajando_con_corredor: "Si" }, "invalid_broker_answer"],
    ["broker Sí missing name", { trabajando_con_corredor: "Sí", nombre_corredor: "", telefono_corredor: "787-555-1111" }, "invalid_nombre_corredor"],
    ["broker Sí missing phone", { trabajando_con_corredor: "Sí", nombre_corredor: "Corredor", telefono_corredor: "" }, "invalid_telefono_corredor"],
    ["broker No rejects details", { trabajando_con_corredor: "No", nombre_corredor: "Unexpected" }, "unexpected_broker_fields"],
    ["missing idempotency UUID", { idempotencyKey: "" }, "invalid_idempotency_key"],
    ["invalid idempotency UUID", { idempotencyKey: "bad" }, "invalid_idempotency_key"],
    ["invalid property UUID", { propertyId: "bad" }, "invalid_property_id"],
    ["invalid property slug", { propertySlug: "Bad Slug" }, "invalid_property_slug"],
    ["invalid showing timestamp", { showingAt: "2035-08-01 14:00" }, "invalid_showing_at"],
    ["overlong name", { nombre: "x".repeat(201) }, "invalid_nombre"],
    ["overlong custom answer", { respuesta_personalizada: "x".repeat(2001) }, "invalid_respuesta_personalizada"],
  ];
  for (const [name, overrides, reason] of cases) {
    await t.test(name, () => expectReason(baseForm(overrides), reason));
  }
});

test("conditional document validation rejects mismatches and unsafe files", async (t) => {
  const pdf = new NodeFile(["pdf"], "doc.pdf", { type: "application/pdf" });
  await t.test("financing rejects proof of funds", () =>
    expectReason(baseForm({ evidencia_fondos_archivo: pdf }), "unexpected_proof_of_funds"));
  await t.test("Cash rejects prequalification", () =>
    expectReason(baseForm({ metodo_compra: "Cash", carta_precalificacion: pdf }), "unexpected_prequalification"));
  await t.test("both documents rejected", () =>
    expectReason(baseForm({ carta_precalificacion: pdf, evidencia_fondos_archivo: pdf }), "multiple_documents"));
  await t.test("invalid MIME rejected", () => {
    const file = new NodeFile(["x"], "x.txt", { type: "text/plain" });
    expectReason(baseForm({ carta_precalificacion: file }), "invalid_document_type");
  });
  await t.test("oversized file rejected", () => {
    const file = new NodeFile([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
    expectReason(baseForm({ carta_precalificacion: file }), "document_too_large");
  });
  await t.test("multiple files under one field rejected", () => {
    const form = baseForm();
    form.append("carta_precalificacion", pdf);
    form.append("carta_precalificacion", pdf);
    expectReason(form, "too_many_files");
  });
});

test("canonical property and showing rules reject stale or unavailable events", async (t) => {
  const input = parseOpenHouseRegistrationFormData(baseForm());
  const cases = [
    ["ID or slug mismatch", { slug: "otra-casa" }, "property_identity_mismatch"],
    ["inactive showing", { showingFormActive: false }, "inactive_showing"],
    ["missing date", { showingAt: null }, "missing_showing_date"],
    ["past showing", { showingAt: new Date("2020-01-01T00:00:00Z") }, "past_showing"],
    ["rescheduled showing", { showingAt: new Date("2035-08-01T19:00:00Z") }, "showing_mismatch"],
    ["non-public status", { status: "vendida" }, "property_not_public"],
    ["unapproved collaborative property", { origin: "co_broke", mayPublishOnWeb: false }, "property_not_public"],
  ];
  for (const [name, overrides, reason] of cases) {
    await t.test(name, () => {
      assert.throws(
        () => validateOpenHouseForProperty(input, propertyFor(input, overrides), new Date("2030-01-01T00:00:00Z")),
        (error) => error instanceof OpenHouseValidationError && error.reason === reason
      );
    });
  }
});

test("property-dependent document and solar rules are enforced", () => {
  const input = parseOpenHouseRegistrationFormData(baseForm());
  assert.throws(
    () => validateOpenHouseForProperty(input, propertyFor(input), new Date("2030-01-01T00:00:00Z")),
    (error) => error.reason === "missing_required_prequalification"
  );
  const cash = parseOpenHouseRegistrationFormData(
    baseForm({ metodo_compra: "Cash" })
  );
  assert.throws(
    () =>
      validateOpenHouseForProperty(
        cash,
        propertyFor(cash),
        new Date("2030-01-01T00:00:00Z")
      ),
    (error) => error.reason === "missing_required_proof_of_funds"
  );
  assert.doesNotThrow(() =>
    validateOpenHouseForProperty(
      input,
      propertyFor(input),
      new Date("2030-01-01T00:00:00Z"),
      true
    )
  );

  assert.throws(
    () =>
      parseOpenHouseRegistrationFormData(
        baseForm({ respuesta_personalizada: "Unexpected" })
      ),
    (error) => error.reason === "unexpected_custom_answer"
  );

  const solarMissing = parseOpenHouseRegistrationFormData(baseForm());
  assert.throws(
    () =>
      validateOpenHouseForProperty(
        solarMissing,
        propertyFor(solarMissing, { hasSolarLease: true }),
        new Date("2030-01-01T00:00:00Z"),
        true
      ),
    (error) => error.reason === "invalid_solar_answer"
  );
  const solarAccepted = parseOpenHouseRegistrationFormData(
    baseForm({ solarContractAcceptance: "yes" })
  );
  assert.doesNotThrow(() =>
    validateOpenHouseForProperty(
      solarAccepted,
      propertyFor(solarAccepted, { hasSolarLease: true }),
      new Date("2030-01-01T00:00:00Z"),
      true
    )
  );
  assert.throws(
    () =>
      validateOpenHouseForProperty(
        solarAccepted,
        propertyFor(solarAccepted),
        new Date("2030-01-01T00:00:00Z"),
        true
      ),
    (error) => error.reason === "unexpected_solar_answer"
  );
});

function candidateLead({ id = randomUUID(), name = "Persona Prueba", email = "open-house@example.test", phone = "787-555-1234" } = {}) {
  const now = new Date();
  return {
    id,
    name,
    emailOriginal: email,
    emailNormalized: normalizeEmail(email),
    phoneOriginal: phone,
    phoneNormalized: normalizePuertoRicoUsPhone(phone),
    status: "new",
    identityStatus: "matched",
    firstSeenAt: now,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    mergedIntoLeadId: null,
  };
}

function reusableDocumentDependencies(leads, documents) {
  return {
    loadCandidates: async () => leads,
    loadDocuments: async (leadId, documentType) =>
      documents.filter(
        (document) =>
          document.lead_id === leadId &&
          document.document_type === documentType
      ),
    inspectObject: async () => ({
      exists: true,
      contentLength: 3,
      contentType: "application/pdf",
    }),
  };
}

function reusableDocument(lead, type = "prequalification_letter") {
  return {
    id: randomUUID(),
    lead_id: lead.id,
    document_type: type,
    document_object_key: `lead-documents/property-buyer-profiles/${randomUUID()}/${type}.pdf`,
    document_original_name: "documento.pdf",
    document_content_type: "application/pdf",
    document_size_bytes: 3,
  };
}

test("Open House reuses only a valid document owned by the same canonical person", async () => {
  const lead = candidateLead();
  const document = reusableDocument(lead);
  const result = await findReusableFinancialDocument(
    {
      name: "Pérsona Prueba",
      email: "OPEN-HOUSE@example.test",
      phone: "+1 (787) 555-1234",
      purchaseMethod: "Financiamiento",
    },
    reusableDocumentDependencies([lead], [document])
  );
  assert.equal(result?.ownerLeadId, lead.id);
  assert.equal(result?.documentType, "prequalification_letter");
});

test("shared contact details never reuse another canonical person's document", async () => {
  const owner = candidateLead({ name: "Persona Uno" });
  const registrant = candidateLead({ name: "Persona Dos" });
  const document = reusableDocument(owner);
  const result = await findReusableFinancialDocument(
    {
      name: registrant.name,
      email: registrant.emailOriginal,
      phone: registrant.phoneOriginal,
      purchaseMethod: "Financiamiento",
    },
    reusableDocumentDependencies([owner, registrant], [document])
  );
  assert.equal(result, null);
});

test("a case member's document and a mismatched document type are not reused", async () => {
  const registrant = candidateLead({ name: "Persona Dos" });
  const relatedPerson = candidateLead({ name: "Persona Familiar" });
  const relatedDocument = reusableDocument(relatedPerson);
  assert.equal(
    await findReusableFinancialDocument(
      {
        name: registrant.name,
        email: registrant.emailOriginal,
        phone: registrant.phoneOriginal,
        purchaseMethod: "Financiamiento",
      },
      reusableDocumentDependencies(
        [registrant, relatedPerson],
        [relatedDocument]
      )
    ),
    null
  );

  const proof = reusableDocument(registrant, "proof_of_funds");
  assert.equal(
    await findReusableFinancialDocument(
      {
        name: registrant.name,
        email: registrant.emailOriginal,
        phone: registrant.phoneOriginal,
        purchaseMethod: "Financiamiento",
      },
      reusableDocumentDependencies([registrant], [proof])
    ),
    null
  );
});

test("missing, incomplete, or inaccessible document metadata requires upload", async () => {
  const lead = candidateLead();
  const document = reusableDocument(lead);
  const missingObjectDependencies = {
    ...reusableDocumentDependencies([lead], [document]),
    inspectObject: async () => ({
      exists: false,
      contentLength: null,
      contentType: null,
    }),
  };
  assert.equal(
    await findReusableFinancialDocument(
      {
        name: lead.name,
        email: lead.emailOriginal,
        phone: lead.phoneOriginal,
        purchaseMethod: "Financiamiento",
      },
      missingObjectDependencies
    ),
    null
  );
});

test("Puerto Rico local showing time converts to the expected UTC instant", async () => {
  const db = new PGlite();
  try {
    const result = await db.query(
      `SELECT timestamp '2035-08-01 14:00:00' AT TIME ZONE 'America/Puerto_Rico' AS showing_at`
    );
    assert.equal(new Date(result.rows[0].showing_at).toISOString(), showingAt);
  } finally {
    await db.close();
  }
});

test("showing event and document keys are deterministic and contain no customer data", () => {
  const propertyId = randomUUID();
  const registrationId = randomUUID();
  assert.equal(
    buildOpenHouseShowingEventKey(propertyId, new Date(showingAt)),
    `open-house:v1:${propertyId}:${showingAt}`
  );
  const key = buildOpenHouseDocumentObjectKey(registrationId, "proof_of_funds", "pdf");
  assert.equal(key, `lead-documents/open-house-registrations/${registrationId}/proof_of_funds.pdf`);
  assert.ok(!key.includes("Persona"));
});

function registration(overrides = {}) {
  return {
    id: randomUUID(),
    leadId: randomUUID(),
    created: true,
    property: { id: randomUUID(), slug: "casa-open-house", title: "Casa Open House" },
    showingAt: new Date(showingAt),
    showingEventKey: "event",
    name: "Persona <script>",
    phone: "787-555-1234",
    email: "open-house@example.test",
    purchaseMethod: "Financiamiento",
    purchaseMethodOther: null,
    attendanceAvailability: "Sí",
    closingFunds: "Sí",
    workingWithBroker: "No",
    brokerName: null,
    brokerPhone: null,
    customQuestion: null,
    customAnswer: null,
    solarContractAcceptance: null,
    prequalificationKey: null,
    prequalificationStatus: "none",
    proofOfFundsKey: null,
    proofOfFundsStatus: "none",
    ...overrides,
  };
}

test("document upload transitions pending to uploaded and never stores a URL", async () => {
  const file = new NodeFile(["pdf"], "private.pdf", { type: "application/pdf" });
  const input = parseOpenHouseRegistrationFormData(baseForm({ carta_precalificacion: file }));
  const key = buildOpenHouseDocumentObjectKey(randomUUID(), "prequalification_letter", "pdf");
  const calls = [];
  const result = await processOpenHousePostCommit({
    registration: registration({ prequalificationKey: key, prequalificationStatus: "pending" }),
    input,
    isR2Configured: () => true,
    upload: async (_file, objectKey) => calls.push(["upload", objectKey]),
    updateDocumentStatus: async (_id, _kind, objectKey, status) => { calls.push([status, objectKey]); return true; },
    deliver: async (email) => { calls.push(["send", email.dedupeKey]); return "sent"; },
    resolveInternalAttachments: async () => [{ filename: "private.pdf", content: "cGRm", contentType: "application/pdf" }],
    internalRecipient: "internal@example.test",
    onError: () => {},
  });
  assert.equal(result.documentState, "uploaded");
  assert.equal(calls.filter(([type]) => type === "upload").length, 1);
  assert.ok(!JSON.stringify(calls).includes("http"));
});

test("R2 failure is permanent for internal mail while customer confirmation remains independent", async () => {
  const file = new NodeFile(["pdf"], "private.pdf", { type: "application/pdf" });
  const input = parseOpenHouseRegistrationFormData(baseForm({ carta_precalificacion: file }));
  const queued = [];
  const result = await processOpenHousePostCommit({
    registration: registration({ prequalificationKey: "lead-documents/open-house-registrations/x/prequalification_letter.pdf", prequalificationStatus: "pending" }),
    input,
    isR2Configured: () => true,
    upload: async () => { throw new Error("provider"); },
    updateDocumentStatus: async (_id, _kind, _key, status) => status === "failed",
    deliver: async (email) => { queued.push(email.emailType); return "sent"; },
    resolveInternalAttachments: async () => undefined,
    internalRecipient: "internal@example.test",
    onError: () => {},
  });
  assert.equal(result.documentState, "failed");
  assert.deepEqual(queued, ["open_house_registration_customer"]);
  assert.equal(result.notificationState.internal, "permanent_failure");
});

test("duplicate retry performs no second R2 upload and delivery remains idempotent", async () => {
  const calls = [];
  const input = parseOpenHouseRegistrationFormData(baseForm());
  const result = await processOpenHousePostCommit({
    registration: registration({ created: false }),
    input,
    isR2Configured: () => true,
    upload: async () => calls.push("upload"),
    updateDocumentStatus: async () => { calls.push("update"); return true; },
    deliver: async () => { calls.push("send"); return "sent"; },
    resolveInternalAttachments: async () => undefined,
    internalRecipient: "internal@example.test",
    onError: () => {},
  });
  assert.deepEqual(calls, ["send", "send"]);
  assert.equal(result.notificationState.internal, "sent");
});

test("internal and customer queues fail independently", async () => {
  const input = parseOpenHouseRegistrationFormData(baseForm());
  const attempted = [];
  const result = await processOpenHousePostCommit({
    registration: registration(),
    input,
    isR2Configured: () => true,
    upload: async () => {},
    updateDocumentStatus: async () => true,
    deliver: async (email) => {
      attempted.push(email.emailType);
      return email.emailType.endsWith("internal") ? "failed_to_queue" : "sent";
    },
    resolveInternalAttachments: async () => undefined,
    internalRecipient: "internal@example.test",
    onError: () => {},
  });
  assert.deepEqual(attempted, ["open_house_registration_internal", "open_house_registration_customer"]);
  assert.equal(result.notificationState.internal, "failed_to_queue");
  assert.equal(result.notificationState.customer, "sent");
});

test("both queue failures still report durable persistence success states", async () => {
  const input = parseOpenHouseRegistrationFormData(baseForm());
  const attempted = [];
  const result = await processOpenHousePostCommit({
    registration: registration(),
    input,
    isR2Configured: () => true,
    upload: async () => {},
    updateDocumentStatus: async () => true,
    deliver: async (email) => {
      attempted.push(email);
      return "failed_to_queue";
    },
    resolveInternalAttachments: async () => undefined,
    internalRecipient: "internal@example.test",
    onError: () => {},
  });
  assert.equal(result.documentState, "none");
  assert.equal(result.notificationState.internal, "failed_to_queue");
  assert.equal(result.notificationState.customer, "failed_to_queue");
  assert.equal(attempted[0].relatedSubmissionType, "open_house_registration");
  assert.match(attempted[0].dedupeKey, /^open_house_registration:.*:internal:v1$/);
  assert.match(attempted[1].dedupeKey, /^open_house_registration:.*:customer:v1$/);
});

test("customer queue is not applicable without email", async () => {
  const input = parseOpenHouseRegistrationFormData(baseForm({ email: "" }));
  const queued = [];
  const result = await processOpenHousePostCommit({
    registration: registration({ email: null }),
    input,
    isR2Configured: () => true,
    upload: async () => {},
    updateDocumentStatus: async () => true,
    deliver: async (email) => { queued.push(email.emailType); return "sent"; },
    resolveInternalAttachments: async () => undefined,
    internalRecipient: "internal@example.test",
    onError: () => {},
  });
  assert.deepEqual(queued, ["open_house_registration_internal"]);
  assert.equal(result.notificationState.customer, "not_applicable");
});

test("email renderers escape submitted content and customer email excludes sensitive answers", () => {
  const item = registration({
    customQuestion: "Question <tag>",
    customAnswer: "Answer <script>",
  });
  const internal = buildOpenHouseInternalEmail({ registration: item, documentStatus: "failed" });
  const customer = buildOpenHouseCustomerEmail(item);
  assert.ok(internal.html.includes("Persona &lt;script&gt;"));
  assert.ok(!internal.html.includes("lead-documents/"));
  assert.ok(!customer.html.includes("Fondos de cierre"));
  assert.ok(!customer.html.includes("Answer"));
});

test("Open House UI and admin configuration use the dedicated attendance workflow", async () => {
  const [page, form, editForm, newPage, leadQuery, casePage] =
    await Promise.all([
      readFile(
        fileURLToPath(
          new URL(
            "../app/(public)/listados/[slug]/registro-openhouse/page.tsx",
            import.meta.url
          )
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL(
            "../components/PerfilCompradorPropiedadForm.tsx",
            import.meta.url
          )
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL(
            "../app/admin/propiedades/[id]/editar/EditarPropiedadForm.tsx",
            import.meta.url
          )
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL("../app/admin/propiedades/nueva/page.tsx", import.meta.url)
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL("../lib/admin/queries/lead-360.ts", import.meta.url)
        ),
        "utf8"
      ),
      readFile(
        fileURLToPath(
          new URL("../app/admin/leads/casos/[id]/page.tsx", import.meta.url)
        ),
        "utf8"
      ),
    ]);

  assert.match(page, /Confirma tu asistencia al Open House/);
  assert.ok(!page.includes("Completa tu perfil de comprador"));
  assert.match(form, /name="disponibilidad_visita"/);
  assert.match(form, /options=\{\["Sí", "No"\]\}/);
  assert.match(form, /name="fondos_gastos_cierre"/);
  assert.match(form, /"Parcialmente", "Aún no"/);
  assert.match(form, /name="metodoCompraOtro"/);
  assert.match(form, /requiresSolarContractAcceptance/);
  assert.match(form, /name="solarContractAcceptance"/);
  assert.match(editForm, /Formulario de Open House/);
  assert.match(newPage, /Formulario de Open House/);
  assert.ok(!editForm.includes("Acepta CDBG"));
  assert.ok(!editForm.includes("Pregunta personalizada"));
  assert.ok(!newPage.includes("Pregunta personalizada"));
  assert.match(editForm, /name="placas_en_lease"/);
  assert.match(newPage, /name="placas_en_lease"/);
  assert.match(leadQuery, /'purchase_method_other'/);
  assert.match(leadQuery, /'solar_contract_acceptance'/);
  assert.match(casePage, /LeadInteractionCard/);
});

test("feature flag is enabled only by exact lowercase true", () => {
  const original = process.env.OPEN_HOUSE_PERSISTENCE_V2;
  try {
    delete process.env.OPEN_HOUSE_PERSISTENCE_V2;
    assert.equal(isOpenHousePersistenceEnabled(), false);
    process.env.OPEN_HOUSE_PERSISTENCE_V2 = "TRUE";
    assert.equal(isOpenHousePersistenceEnabled(), false);
    process.env.OPEN_HOUSE_PERSISTENCE_V2 = "true";
    assert.equal(isOpenHousePersistenceEnabled(), true);
  } finally {
    if (original === undefined) delete process.env.OPEN_HOUSE_PERSISTENCE_V2;
    else process.env.OPEN_HOUSE_PERSISTENCE_V2 = original;
  }
});

test("V2 source uses row locking, canonical PR timezone, and leaves legacy URL columns unwritten", async () => {
  const persistence = await readFile(
    fileURLToPath(new URL("../lib/leads/postgres-open-house-registration.ts", import.meta.url)),
    "utf8"
  );
  const route = await readFile(
    fileURLToPath(new URL("../app/api/consultas-propiedad/route.ts", import.meta.url)),
    "utf8"
  );
  const form = await readFile(
    fileURLToPath(new URL("../components/PerfilCompradorPropiedadForm.tsx", import.meta.url)),
    "utf8"
  );
  assert.match(persistence, /FOR UPDATE/);
  assert.match(persistence, /AT TIME ZONE 'America\/Puerto_Rico'/);
  const insertColumns = persistence.match(/INSERT INTO public\.consultas_propiedad \(([\s\S]*?)\) VALUES/)?.[1] || "";
  assert.ok(!insertColumns.includes("carta_precalificacion_url"));
  assert.ok(!insertColumns.includes("evidencia_fondos,"));
  assert.match(route, /if \(isOpenHousePersistenceEnabled\(\)\)/);
  assert.match(form, /value: "Cash"/);
  assert.match(form, /label: "Otros", value: "Otro"/);
  assert.match(form, /¿Podrá asistir al Open House en la fecha y hora indicadas\?/);
  assert.match(form, /¿Cuenta con fondos para el pronto y los gastos de cierre\?/);
  assert.match(form, /value: "Sí"/);
  assert.ok(!form.includes('value: "Efectivo"'));
});
