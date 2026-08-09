import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "./domain/database";
import { createConfiguredSignatureDomainServices } from "./config";
import { createPrivateSignatureR2Storage } from "./storage";
import { createSignatureDraftApplicationService } from "./draft-application";

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
    storage: createPrivateSignatureR2Storage(),
  };
}

export function createSignatureDraftRuntime() {
  const runtime = createSignatureRuntime();
  return {
    ...runtime,
    drafts: createSignatureDraftApplicationService(runtime),
  };
}
