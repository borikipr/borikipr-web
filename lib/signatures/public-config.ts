export const SIGNING_PUBLIC_ENABLED_ENV = "SIGNING_PUBLIC_ENABLED";
export const SIGNING_INTERNAL_CANARY_ENABLED_ENV = "SIGNING_INTERNAL_CANARY_ENABLED";
export const SIGNING_INTERNAL_CANARY_READINESS_SHA256_ENV = "SIGNING_INTERNAL_CANARY_READINESS_SHA256";
export const SIGNING_PUBLIC_READINESS_SHA256_ENV = "SIGNING_PUBLIC_READINESS_SHA256";

export function isPublicSigningEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return environment[SIGNING_PUBLIC_ENABLED_ENV]?.trim().toLowerCase() === "true";
}

export function isInternalCanarySigningEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return environment.NODE_ENV !== "production" &&
    environment.SIGNING_ISOLATED_ENVIRONMENT === "true" &&
    environment[SIGNING_INTERNAL_CANARY_ENABLED_ENV]?.trim().toLowerCase() === "true";
}

export function isProductionInternalCanaryCapabilityEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return environment.NODE_ENV === "production" &&
    environment[SIGNING_INTERNAL_CANARY_ENABLED_ENV]?.trim().toLowerCase() === "true" &&
    /^[0-9a-f]{64}$/.test(environment[SIGNING_INTERNAL_CANARY_READINESS_SHA256_ENV]?.trim() ?? "");
}

export function isSignerRuntimeEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return isPublicSigningEnabled(environment) || isInternalCanarySigningEnabled(environment) ||
    isProductionInternalCanaryCapabilityEnabled(environment);
}

export function assertPublicSigningEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  if (!isPublicSigningEnabled(environment)) {
    throw new Error("public_signing_disabled");
  }
}
