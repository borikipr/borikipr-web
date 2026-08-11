export const SIGNING_PUBLIC_ENABLED_ENV = "SIGNING_PUBLIC_ENABLED";
export const SIGNING_INTERNAL_CANARY_ENABLED_ENV = "SIGNING_INTERNAL_CANARY_ENABLED";

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

export function isSignerRuntimeEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return isPublicSigningEnabled(environment) || isInternalCanarySigningEnabled(environment);
}

export function assertPublicSigningEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  if (!isPublicSigningEnabled(environment)) {
    throw new Error("public_signing_disabled");
  }
}
