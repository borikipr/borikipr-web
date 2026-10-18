import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ATTENDANCE_OPTIONS,
  buildHaciendaShowingEmail,
  FINANCING_STATUS_OPTIONS,
  formatPuertoRicoTimestamp,
  HACIENDA_SHOWING_CUTOFF_ISO,
  HACIENDA_SHOWING_ROUTE,
  isHaciendaShowingClosed,
  PROPERTY_INTEREST_OPTIONS,
  PURCHASE_METHOD_OPTIONS,
  REALTOR_OPTIONS,
  validateHaciendaShowingPayload,
} from "../lib/hacienda-monte-carmelo-showing.ts";
import { createHaciendaShowingPostHandler } from "../lib/hacienda-monte-carmelo-showing-handler.ts";

const validPayload = (overrides = {}) => ({
  name: "María Rivera",
  phone: "787-555-1234",
  email: " MARIA@example.com ",
  attendance: ATTENDANCE_OPTIONS[0],
  purchaseMethod: PURCHASE_METHOD_OPTIONS[0],
  financingStatus: "",
  interests: [PROPERTY_INTEREST_OPTIONS[0], PROPERTY_INTEREST_OPTIONS[2]],
  otherInterest: "",
  worksWithRealtor: "No",
  realtorName: "",
  realtorPhone: "",
  comments: "Primera línea.\r\nSegunda línea.",
  privacyAcknowledged: true,
  website: "",
  ...overrides,
});

const validConfig = {
  apiKey: "re_test_key",
  fromEmail: "forms@example.com",
  toEmail: "ivonne@example.com",
};

function request(payload = validPayload()) {
  return new Request("https://borikipr.com/api/hacienda-monte-carmelo-showing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function expectValidation(payload, reason) {
  assert.throws(
    () => validateHaciendaShowingPayload(payload),
    (error) => error?.reason === reason
  );
}

test("dedicated route renders exact content, complete image, noindex, and dynamic closed state", async () => {
  const [page, image] = await Promise.all([
    readFile(
      fileURLToPath(new URL("../app/(public)/listados/hacienda-monte-carmelo-cascadas-cafe-guayanilla/registro-showing/page.tsx", import.meta.url)),
      "utf8"
    ),
    readFile(fileURLToPath(new URL("../public/images/hacienda-monte-carmelo-showing.jpeg", import.meta.url))),
  ]);
  assert.equal(HACIENDA_SHOWING_ROUTE, "/listados/hacienda-monte-carmelo-cascadas-cafe-guayanilla/registro-showing");
  assert.match(page, /21 CUERDAS DE TERRENO \| HACIENDA MONTE CARMELO/);
  assert.match(page, /Gracias por tu interés en Hacienda Monte Carmelo/);
  assert.match(page, /hacienda-monte-carmelo-showing\.jpeg/);
  assert.match(page, /width=\{940\}/);
  assert.match(page, /height=\{788\}/);
  assert.match(page, /object-contain/);
  assert.doesNotMatch(page, /object-cover/);
  assert.match(page, /index: false/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(page, /await connection\(\)/);
  assert.equal(
    createHash("sha256").update(image).digest("hex").toUpperCase(),
    "AF43DD895F1660810AE9F2A9EB040942CCE161ADB62E862BB520127D4FFA59F6"
  );
});

test("all selectable options use the final approved labels without terminal periods", () => {
  assert.deepEqual(PURCHASE_METHOD_OPTIONS, [
    "Compra en efectivo (cash)",
    "Mediante financiamiento",
    "Dependerá de la negociación y las condiciones de compra",
  ]);
  assert.deepEqual(FINANCING_STATUS_OPTIONS, [
    "Tengo carta de precualificación",
    "Estoy en proceso con una institución financiera",
    "Todavía no he comenzado el proceso",
  ]);
  for (const option of [
    ...ATTENDANCE_OPTIONS,
    ...PURCHASE_METHOD_OPTIONS,
    ...FINANCING_STATUS_OPTIONS,
    ...PROPERTY_INTEREST_OPTIONS,
    ...REALTOR_OPTIONS,
  ]) {
    assert.equal(option.endsWith("."), false, option);
  }
});

test("required contact fields and email are validated and normalized", () => {
  expectValidation(validPayload({ name: "" }), "invalid_name");
  expectValidation(validPayload({ phone: "123" }), "invalid_phone");
  expectValidation(validPayload({ email: "not-an-email" }), "invalid_email");
  const parsed = validateHaciendaShowingPayload(validPayload());
  assert.equal(parsed.phone, "(787) 555-1234");
  assert.equal(parsed.email, "maria@example.com");
});

test("all attendance and purchase options are accepted", () => {
  for (const attendance of ATTENDANCE_OPTIONS) {
    assert.equal(validateHaciendaShowingPayload(validPayload({ attendance })).attendance, attendance);
  }
  for (const purchaseMethod of PURCHASE_METHOD_OPTIONS) {
    const financingStatus = purchaseMethod === "Mediante financiamiento"
      ? FINANCING_STATUS_OPTIONS[0]
      : "";
    assert.equal(validateHaciendaShowingPayload(validPayload({ purchaseMethod, financingStatus })).purchaseMethod, purchaseMethod);
  }
});

test("financing status is conditionally required and independently enforced", () => {
  expectValidation(
    validPayload({ purchaseMethod: "Mediante financiamiento", financingStatus: "" }),
    "invalid_financing_status"
  );
  expectValidation(
    validPayload({ purchaseMethod: PURCHASE_METHOD_OPTIONS[0], financingStatus: FINANCING_STATUS_OPTIONS[0] }),
    "unexpected_financing_status"
  );
  assert.equal(
    validateHaciendaShowingPayload(validPayload({ purchaseMethod: "Mediante financiamiento", financingStatus: FINANCING_STATUS_OPTIONS[1] })).financingStatus,
    FINANCING_STATUS_OPTIONS[1]
  );
});

test("removed purchase and financing values are rejected server-side", () => {
  expectValidation(
    validPayload({ purchaseMethod: "Estoy evaluando mis opciones." }),
    "invalid_purchase_method"
  );
  expectValidation(
    validPayload({
      purchaseMethod: "Mediante financiamiento",
      financingStatus: "Tengo carta de precualificación o preaprobación.",
    }),
    "invalid_financing_status"
  );
  expectValidation(
    validPayload({ purchaseMethod: "Mediante financiamiento", financingStatus: "No aplica." }),
    "invalid_financing_status"
  );
  expectValidation(validPayload({ attendance: "Sí, asistiré." }), "invalid_attendance");
  expectValidation(
    validPayload({ interests: ["Proyecto agrícola o cultivo de café."] }),
    "invalid_interests"
  );
  expectValidation(validPayload({ worksWithRealtor: "No." }), "invalid_realtor_answer");
});

test("multiple interests and optional other-interest details are supported", () => {
  const parsed = validateHaciendaShowingPayload(validPayload({
    interests: [PROPERTY_INTEREST_OPTIONS[0], PROPERTY_INTEREST_OPTIONS[4]],
    otherInterest: "Conservación.",
  }));
  assert.deepEqual(parsed.interests, [PROPERTY_INTEREST_OPTIONS[0], PROPERTY_INTEREST_OPTIONS[4]]);
  assert.equal(parsed.otherInterest, "Conservación.");
  expectValidation(validPayload({ interests: [], otherInterest: "No aplica" }), "unexpected_other_interest");
});

test("Realtor fields are conditional, required, normalized, and stale values are rejected", () => {
  expectValidation(validPayload({ worksWithRealtor: "Sí" }), "invalid_realtor_name");
  expectValidation(validPayload({ worksWithRealtor: "No", realtorName: "Corredor Ejemplo" }), "unexpected_realtor_fields");
  const parsed = validateHaciendaShowingPayload(validPayload({
    worksWithRealtor: "Sí",
    realtorName: "Ana López",
    realtorPhone: "+1 939 555 1212",
  }));
  assert.equal(parsed.realtorName, "Ana López");
  assert.equal(parsed.realtorPhone, "+19395551212");
});

test("comments are optional, preserve line breaks, and privacy acknowledgment is required", () => {
  assert.equal(validateHaciendaShowingPayload(validPayload({ comments: "" })).comments, null);
  assert.equal(validateHaciendaShowingPayload(validPayload()).comments, "Primera línea.\nSegunda línea.");
  expectValidation(validPayload({ privacyAcknowledged: false }), "privacy_not_acknowledged");
});

test("email renderer includes requested Spanish labels and escapes all user content", () => {
  const submission = validateHaciendaShowingPayload(validPayload({
    name: "María <Rivera>",
    comments: "Pregunta <script>\nOtra línea",
  }));
  const email = buildHaciendaShowingEmail(submission, new Date("2026-10-24T18:05:00Z"));
  assert.match(email.subject, /Hacienda Monte Carmelo \| Registro Showing/);
  assert.match(email.html, /Nombre completo/);
  assert.match(email.html, /Asistencia/);
  assert.match(email.html, /Intereses/);
  assert.match(email.html, /Compra en efectivo \(cash\)/);
  assert.doesNotMatch(email.html, /Compra en efectivo \(cash\)\./);
  assert.match(email.html, /María &lt;Rivera&gt;/);
  assert.match(email.html, /Pregunta &lt;script&gt;<br \/>Otra línea/);
  assert.doesNotMatch(email.html, /Pregunta <script>/);
});

test("successful Resend acceptance is the only success response", async () => {
  const messages = [];
  const handler = createHaciendaShowingPostHandler({
    now: () => new Date("2026-10-25T13:59:59Z"),
    config: validConfig,
    checkRequestRateLimit: async () => true,
    sendEmail: async (message) => {
      messages.push(message);
      return { id: "email_accepted" };
    },
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, validConfig.toEmail);
});

test("Resend rejection and missing configuration never return success", async () => {
  const rejectionHandler = createHaciendaShowingPostHandler({
    now: () => new Date("2026-10-25T13:59:59Z"),
    config: validConfig,
    checkRequestRateLimit: async () => true,
    sendEmail: async () => { throw new Error("provider rejection"); },
  });
  const rejected = await rejectionHandler(request());
  assert.equal(rejected.status, 502);
  assert.equal((await rejected.json()).ok, false);

  const missingConfigHandler = createHaciendaShowingPostHandler({
    now: () => new Date("2026-10-25T13:59:59Z"),
    config: {},
    checkRequestRateLimit: async () => true,
  });
  const missing = await missingConfigHandler(request());
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).ok, false);
});

test("deadline is open before cutoff and closed exactly at and after cutoff", async () => {
  assert.equal(isHaciendaShowingClosed(new Date("2026-10-25T13:59:59.999Z")), false);
  assert.equal(isHaciendaShowingClosed(new Date(HACIENDA_SHOWING_CUTOFF_ISO)), true);
  assert.equal(isHaciendaShowingClosed(new Date("2026-10-25T14:00:00.001Z")), true);

  for (const instant of [HACIENDA_SHOWING_CUTOFF_ISO, "2026-10-25T14:00:01Z"]) {
    let sends = 0;
    const handler = createHaciendaShowingPostHandler({
      now: () => new Date(instant),
      config: validConfig,
      checkRequestRateLimit: async () => true,
      sendEmail: async () => { sends += 1; return { id: "should-not-send" }; },
    });
    const response = await handler(request());
    assert.equal(response.status, 410);
    assert.equal(sends, 0);
  }
});

test("Puerto Rico event cutoff and displayed timestamps use the correct UTC conversion", () => {
  assert.equal(HACIENDA_SHOWING_CUTOFF_ISO, "2026-10-25T14:00:00.000Z");
  const formatted = formatPuertoRicoTimestamp(new Date("2026-10-25T13:30:00Z"));
  assert.match(formatted, /9:30:00/);
  assert.match(formatted, /(AST|GMT-4)/);
});

test("client prevents duplicate pending submits and clears hidden conditional values", async () => {
  const form = await readFile(
    fileURLToPath(new URL("../components/HaciendaMonteCarmeloShowingForm.tsx", import.meta.url)),
    "utf8"
  );
  assert.match(form, /if \(submittingRef\.current\) return/);
  assert.match(form, /disabled=\{submitting\}/);
  assert.match(form, /setFinancingStatus\(""\)/);
  assert.match(form, /setRealtorName\(""\)/);
  assert.match(form, /setRealtorPhone\(""\)/);
  assert.match(form, /data-clarity-mask="true"/);
  assert.match(form, /method="post"/);
  assert.match(form, /action="\/api\/hacienda-monte-carmelo-showing"/);
  assert.doesNotMatch(form, /localStorage/);
});

test("route stays unlisted, analytics-excluded, and existing public forms remain untouched", async () => {
  const [sitemap, analyticsRoutes] = await Promise.all([
    readFile(fileURLToPath(new URL("../app/sitemap.ts", import.meta.url)), "utf8"),
    readFile(fileURLToPath(new URL("../lib/analytics-routes.ts", import.meta.url)), "utf8"),
  ]);
  assert.doesNotMatch(sitemap, /registro-showing/);
  assert.match(analyticsRoutes, /hacienda-monte-carmelo-cascadas-cafe-guayanilla\/registro-showing/);
  assert.doesNotMatch(analyticsRoutes, /trackAnalyticsEvent|searchParams/);
});
