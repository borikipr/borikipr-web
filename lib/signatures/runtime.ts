import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "./domain/database";
import { createConfiguredSignatureDomainServices } from "./config";
import { createPrivateSignatureStorage } from "./storage";
import { createSignatureDraftApplicationService } from "./draft-application";
import { createResendSignatureTransport, createSignatureDeliveryService } from "./delivery";
import { createIsolatedSignatureMailTransport } from "./isolated-test-sink";
import { getSignatureSecurityConfig } from "./config";
import { isSignerAccessAuthorized } from "./canary-gate";

export function createSignatureDomainRuntime() {
  const database = createPostgresSignatureDatabase(sql);
  const domain = createConfiguredSignatureDomainServices(database);
  return {
    database,
    domain,
  };
}

export function createSignatureRuntime() {
  const runtime = createSignatureDomainRuntime();
  return {
    ...runtime,
    storage: createPrivateSignatureStorage(),
  };
}

export function createSignatureDraftRuntime() {
  const runtime = createSignatureRuntime();
  return {
    ...runtime,
    drafts: createSignatureDraftApplicationService(runtime),
  };
}

export function createSignatureDeliveryRuntime() {
  const runtime = createSignatureRuntime();
  const security = getSignatureSecurityConfig();
  return {
    ...runtime,
    delivery: createSignatureDeliveryService({
      database: runtime.database,
      domain: runtime.domain,
      mail: process.env.SIGNING_ISOLATED_ENVIRONMENT === "true"
        ? createIsolatedSignatureMailTransport()
        : createResendSignatureTransport(),
      publicBaseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://borikipr.com",
      tokenKeyVersion: security.currentVersion,
      authorizeInvitation: (binding) => isSignerAccessAuthorized(runtime.database,binding),
    }),
  };
}
